using MarketOps.Api;
using MarketOps.Artifacts;
using MarketOps.Contracts;
using MarketOps.Pipeline;
using MarketOps.Ports;
using MarketOps.Security;

var builder = WebApplication.CreateBuilder(args);

// Configure port
var port = int.Parse(Environment.GetEnvironmentVariable("MARKETOPS_PORT") ?? "9410");
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Add services
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

builder.Services.AddSingleton<ISideEffectPort, NullSinkSideEffectPort>();
builder.Services.AddSingleton<MarketOpsController>();
builder.Services.AddSingleton(sp =>
{
    Action<string> auditLog = (msg) => Console.WriteLine($"[AUDIT] {msg}");
    return new MarketOpsPipeline(sp.GetRequiredService<ISideEffectPort>(), auditLog);
});
builder.Services.AddSingleton<ArtifactGenerator>();
builder.Services.AddSingleton<FcSigner>();
builder.Services.AddSingleton<Ed25519Signer>();

var app = builder.Build();

app.UseCors("AllowAll");

// Map endpoints
var controller = app.Services.GetRequiredService<MarketOpsController>();
var pipeline = app.Services.GetRequiredService<MarketOpsPipeline>();
var artifactGenerator = app.Services.GetRequiredService<ArtifactGenerator>();
var fcSigner = app.Services.GetRequiredService<FcSigner>();
var ed25519Signer = app.Services.GetRequiredService<Ed25519Signer>();

// Helper: build advisory reasons from intents, then sign via FC
JudgeAdvisoryReceipt GenerateSignedAdvisory(
    ArtifactGenerator gen, string runId, string tenantId, List<SideEffectIntent> intents,
    PublicationPlan plan, ProofLedger ledger, FcSigner signer)
{
    var reasons = new List<string> { "dry_run_preview" };

    var policyBlockedIntents = intents.Where(i => i.BlockedByPolicy).ToList();
    if (policyBlockedIntents.Any())
    {
        reasons.Add("policy_violation_detected");
        foreach (var intent in policyBlockedIntents)
        {
            reasons.AddRange(intent.PolicyDenialReasons);
        }
    }

    return gen.GenerateAdvisoryReceipt(runId, tenantId, reasons, plan, ledger, signer);
}

app.MapPost("/marketops/runs", async (HttpContext context) =>
{
    try
    {
        using var reader = new StreamReader(context.Request.Body);
        var json = await reader.ReadToEndAsync();
        var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Parse mode (can be null, "dry_run", or "prod")
        ExecutionMode? mode = null;
        if (root.TryGetProperty("mode", out var modeElem) && modeElem.ValueKind != System.Text.Json.JsonValueKind.Null)
        {
            var modeStr = modeElem.GetString()?.ToLowerInvariant();
            mode = modeStr switch
            {
                "dry_run" => ExecutionMode.DryRun,
                "prod" => ExecutionMode.Prod,
                _ => null
            };
        }

        // Parse input
        Dictionary<string, object?>? input = null;
        if (root.TryGetProperty("input", out var inputElem))
        {
            input = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(inputElem.GetRawText());
        }

        // Parse tenantId (default: "tenant-demo")
        string? tenantId = null;
        if (root.TryGetProperty("tenantId", out var tenantElem))
        {
            tenantId = tenantElem.GetString();
        }

        // Parse correlationId
        string? correlationId = null;
        if (root.TryGetProperty("correlationId", out var corrElem))
        {
            correlationId = corrElem.GetString();
        }

        var request = new StartRunRequest(mode, tenantId, input, correlationId);
        var response = await controller.StartRunAsync(request);

        // Execute pipeline to generate artifacts
        var runId = response.RunId;
        var actualTenantId = tenantId ?? "tenant-demo";
        var run = new MarketOpsRun(
            RunId: runId,
            TenantId: actualTenantId,
            Mode: mode ?? ExecutionMode.DryRun,
            StartedAt: DateTimeOffset.UtcNow,
            Input: input ?? new Dictionary<string, object?>(),
            CorrelationId: correlationId);

        var pipelineResult = await pipeline.ExecuteAsync(run);

        app.Logger.LogInformation("Pipeline result: Success={Success}, Plan={HasPlan}, Ledger={HasLedger}",
            pipelineResult.Success, pipelineResult.Plan != null, pipelineResult.Ledger != null);

        if (pipelineResult.Success && pipelineResult.Plan != null && pipelineResult.Ledger != null)
        {
            // Generate artifacts
            var plan = artifactGenerator.GeneratePublicationPlan(
                runId,
                actualTenantId,
                run.Mode,
                pipelineResult.Plan.WouldShip,
                pipelineResult.Plan.WouldNotShip,
                pipelineResult.Plan.Reasons);

            var ledger = artifactGenerator.GenerateProofLedger(
                runId,
                actualTenantId,
                run.Mode,
                pipelineResult.Ledger.SideEffectIntents,
                pipelineResult.Ledger.SideEffectReceipts);

            // Generate signed advisory (dry_run only) — binds to plan + ledger hashes
            var advisory = run.IsDryRun
                ? GenerateSignedAdvisory(artifactGenerator, runId, actualTenantId,
                    pipelineResult.Ledger.SideEffectIntents, plan, ledger, fcSigner)
                : null;

            // Bind ledger → receipt (immutable update via with-expression)
            if (advisory != null)
            {
                ledger = ledger with
                {
                    ReceiptId = advisory.Id,
                    ReceiptDigest = advisory.Digests.ReceiptSha256
                };
            }

            // Update controller state with artifacts
            controller.UpdateRunState(runId, plan, ledger, advisory);
            app.Logger.LogInformation("Artifacts generated and stored for run {RunId}", runId);
        }
        else
        {
            app.Logger.LogWarning("Pipeline did not produce artifacts for run {RunId}", runId);
        }

        await context.Response.WriteAsJsonAsync(response);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error processing /marketops/runs request");
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

app.MapGet("/marketops/runs/{id}", async (string id) =>
{
    return await controller.GetRunAsync(id);
});

app.MapGet("/marketops/runs/{id}/plan", async (string id) =>
{
    return await controller.GetPlanAsync(id);
});

app.MapGet("/marketops/runs/{id}/ledger", async (string id) =>
{
    return await controller.GetLedgerAsync(id);
});

app.MapGet("/marketops/runs/{id}/advisory", async (string id) =>
{
    return await controller.GetAdvisoryAsync(id);
});

app.MapGet("/marketops/runs/{id}/summary", async (string id) =>
{
    try
    {
        var summary = await controller.GetSummaryAsync(id);
        return Results.Json(summary, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never,
            WriteIndented = true
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error getting summary for run {RunId}", id);
        return Results.Problem($"Failed to generate summary: {ex.Message}");
    }
});

app.MapGet("/marketops/runs/{id}/summary.md", async (string id) =>
{
    try
    {
        var markdown = await controller.GetSummaryMarkdownAsync(id);
        return Results.Text(markdown, "text/markdown");
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error getting summary markdown for run {RunId}", id);
        return Results.Problem($"Failed to generate summary: {ex.Message}");
    }
});

app.MapPost("/marketops/proofpack", async (HttpContext context) =>
{
    try
    {
        using var reader = new StreamReader(context.Request.Body);
        var json = await reader.ReadToEndAsync();
        var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Parse runIds array
        if (!root.TryGetProperty("runIds", out var runIdsElem) || runIdsElem.ValueKind != System.Text.Json.JsonValueKind.Array)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { error = "runIds array is required" });
            return;
        }

        // Parse scenarios map { "runId": "scenario-name" }
        var scenarios = new Dictionary<string, string>();
        if (root.TryGetProperty("scenarios", out var scenariosElem))
        {
            foreach (var prop in scenariosElem.EnumerateObject())
            {
                scenarios[prop.Name] = prop.Value.GetString() ?? "unknown";
            }
        }

        // Gather run inputs
        var runInputs = new List<ProofPackRunInput>();
        foreach (var runIdElem in runIdsElem.EnumerateArray())
        {
            var runId = runIdElem.GetString()!;
            var scenario = scenarios.GetValueOrDefault(runId, "unknown");
            var input = await controller.GetRunForProofPackAsync(runId, scenario);
            runInputs.Add(input);
        }

        // Generate proof pack — write to repo root evidence/ folder
        var repoRoot = FindRepoRoot(Directory.GetCurrentDirectory());
        var outputDir = Path.Combine(repoRoot, "evidence", "proofpack-v1");
        var generator = new ProofPackGenerator(msg => app.Logger.LogInformation("[AUDIT] {Msg}", msg), fcSigner, ed25519Signer);
        var packIndex = generator.Generate(outputDir, runInputs);

        app.Logger.LogInformation("Proof Pack generated: {PackId} with {RunCount} runs, seal={Seal}",
            packIndex.PackId, packIndex.Runs.Count, packIndex.PackSha256);

        var packJson = System.Text.Json.JsonSerializer.Serialize(packIndex, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = true
        });
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(packJson);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error generating proof pack");
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

app.MapGet("/health", () => new { status = "healthy", port })
    .WithName("Health")
    .WithOpenApi();

var portDisplay = Environment.GetEnvironmentVariable("MARKETOPS_PORT") ?? "9410";
app.Logger.LogInformation("🔱 MarketOps API Host starting on port {Port}", portDisplay);

await app.RunAsync();

// ── Helpers ──────────────────────────────────────────────────────

static string FindRepoRoot(string startDir)
{
    var dir = new DirectoryInfo(startDir);
    while (dir != null)
    {
        if (Directory.Exists(Path.Combine(dir.FullName, ".git")))
            return dir.FullName;
        dir = dir.Parent;
    }
    // Fallback: use current directory
    return startDir;
}
