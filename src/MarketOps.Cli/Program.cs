using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Runtime.CompilerServices;
using MarketOps.Contracts;
using MarketOps.Gate;
using MarketOps.OmegaSdk.Adapters;
using MarketOps.OmegaSdk.Ports;
using Omega.Sdk;

[assembly: InternalsVisibleTo("MarketOps.Cli.Tests")]

namespace MarketOps.Cli;

public static class Program
{
    private const int ExitAllowed = 0;
    private const int ExitDenied = 1;
    private const int ExitDeniedFailClosed = 2;
    private const int ExitSystemError = 3;

    public static async Task<int> Main(string[] args)
        => await RunAsync(args, Console.Out, Console.Error).ConfigureAwait(false);

    internal static async Task<int> RunAsync(string[] args, TextWriter stdout, TextWriter stderr)
    {
        if (args.Length == 0 || IsHelp(args[0]))
        {
            PrintUsage(stderr);
            return ExitSystemError;
        }

        var command = args[0].Trim().ToLowerInvariant();
        if (command != "gate" && command != "precheck")
        {
            stderr.WriteLine($"Unknown command: {args[0]}");
            PrintUsage(stderr);
            return ExitSystemError;
        }

        var optionsResult = ParseOptions(args.Skip(1).ToArray());
        if (!optionsResult.Success)
        {
            stderr.WriteLine(optionsResult.ErrorMessage);
            return ExitSystemError;
        }

        var options = optionsResult.Options!;

        if (string.IsNullOrWhiteSpace(options.PacketPath))
        {
            stderr.WriteLine("Missing required --packet <path>.");
            return ExitSystemError;
        }

        PublishPacket packet;
        try
        {
            packet = await LoadPacketAsync(options.PacketPath).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            stderr.WriteLine($"PACKET_READ_FAILED {ex.Message}");
            return ExitSystemError;
        }

        if (command == "precheck")
        {
            var receipt = RunPrecheck(packet, options, stderr);
            WriteReceipt(receipt, options, stdout);
            stderr.WriteLine("NOTE: precheck does not call governance and does not verify evidence.");
            return receipt.Result.Allowed ? ExitAllowed : ExitDenied;
        }

        try
        {
            var gateResult = await RunGateAsync(packet, options, stderr).ConfigureAwait(false);
            WriteReceipt(gateResult, options, stdout);
            return ToExitCode(gateResult.Result);
        }
        catch (Exception ex)
        {
            stderr.WriteLine($"GATE_FAILED {ex.Message}");
            return ExitSystemError;
        }
    }

    private static GateCliReceipt RunPrecheck(PublishPacket packet, CliOptions options, TextWriter stderr)
    {
        var config = BuildConfig(options, stderr);
        var validation = ValidatePacket(packet);
        if (validation != null)
            return new GateCliReceipt("precheck", GateResult.Deny(FailureStage.Precheck, validation.Value.Code, validation.Value.Message, packet, null, null));

        var packetHash = "unavailable-in-precheck";
        if (!string.Equals(packet.TenantId, config.TenantId, StringComparison.Ordinal))
            return new GateCliReceipt("precheck", GateResult.Deny(FailureStage.Precheck, "TENANT_MISMATCH", "Tenant mismatch", packet, packetHash));
        if (!string.Equals(packet.ActorId, config.ActorId, StringComparison.Ordinal))
            return new GateCliReceipt("precheck", GateResult.Deny(FailureStage.Precheck, "ACTOR_MISMATCH", "Actor mismatch", packet, packetHash));

        var deniedDests = packet.Destinations.Where(d => !config.IsDestinationAllowed(d)).ToList();
        if (deniedDests.Count > 0)
            return new GateCliReceipt("precheck", GateResult.Deny(FailureStage.Precheck, "DESTINATION_NOT_ALLOWED", $"Denied: {string.Join(", ", deniedDests)}", packet, packetHash));

        return new GateCliReceipt("precheck", new GateResult(true, null, null, null, packetHash, packet, null));
    }

    private static async Task<GateCliReceipt> RunGateAsync(PublishPacket packet, CliOptions options, TextWriter stderr)
    {
        var config = BuildConfig(options, stderr);
        var omegaUrl = options.ControlUrl ?? Environment.GetEnvironmentVariable("OMEGA_SDK_URL");
        if (string.IsNullOrWhiteSpace(omegaUrl))
            throw new InvalidOperationException("Missing OMEGA_SDK_URL or --control-url for governance operations.");

        var omegaClient = new OmegaClient(new OmegaOptions { FederationUrl = omegaUrl });
        var decisionClient = new OmegaDecisionClient(omegaClient);
        var auditWriter = new OmegaAuditWriter(omegaClient);
        var evidenceVerifier = new OmegaEvidenceVerifier(omegaClient);
        IGovernanceExecutionClient? executionClient = options.EnableExecution ? new OmegaExecutionClient(omegaClient) : null;

        var gate = new OmegaGate(decisionClient, auditWriter, evidenceVerifier, config, executionClient, message => stderr.WriteLine(message));
        var result = await gate.EvaluateAsync(packet, CancellationToken.None).ConfigureAwait(false);
        return new GateCliReceipt("full", result);
    }

    private static MarketOpsGateConfig BuildConfig(CliOptions options, TextWriter stderr)
        => MarketOpsGateConfig.Build(new MarketOpsGateOverrides(AuditRoot: options.AuditRoot, PublicKeyPath: options.PublicKeyPath, TrustBundlePath: options.TrustBundlePath), message => stderr.WriteLine(message));

    private static async Task<PublishPacket> LoadPacketAsync(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("Packet file not found.", path);
        var json = await File.ReadAllTextAsync(path).ConfigureAwait(false);
        var packet = JsonSerializer.Deserialize<PublishPacket>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (packet is null) throw new InvalidOperationException("Packet JSON could not be parsed.");
        return packet;
    }

    private static void WriteReceipt(GateCliReceipt receipt, CliOptions options, TextWriter stdout)
    {
        var json = JsonSerializer.Serialize(receipt, new JsonSerializerOptions { WriteIndented = options.Pretty });
        if (string.IsNullOrWhiteSpace(options.OutPath) || options.OutPath == "-")
            stdout.WriteLine(json);
        else
            File.WriteAllText(options.OutPath, json);
    }

    private static int ToExitCode(GateResult result)
    {
        if (result.Allowed) return ExitAllowed;
        return result.FailureStage switch
        {
            FailureStage.Precheck => ExitDenied,
            FailureStage.Decision => ExitDenied,
            FailureStage.Exception => ExitSystemError,
            FailureStage.Hash => ExitDeniedFailClosed,
            FailureStage.Audit => ExitDeniedFailClosed,
            FailureStage.EvidencePack => ExitDeniedFailClosed,
            FailureStage.Verify => ExitDeniedFailClosed,
            _ => ExitDenied
        };
    }

    private static (string Code, string Message)? ValidatePacket(PublishPacket packet)
    {
        if (packet is null) return ("PACKET_NULL", "Packet cannot be null.");
        if (string.IsNullOrWhiteSpace(packet.ArtifactId)) return ("ARTIFACT_ID_MISSING", "ArtifactId cannot be empty.");
        if (string.IsNullOrWhiteSpace(packet.TenantId)) return ("TENANT_ID_MISSING", "TenantId cannot be empty.");
        if (string.IsNullOrWhiteSpace(packet.CorrelationId)) return ("CORRELATION_ID_MISSING", "CorrelationId cannot be empty.");
        if (packet.Destinations == null || packet.Destinations.Count == 0) return ("DESTINATIONS_EMPTY", "Destinations cannot be empty.");
        foreach (var destination in packet.Destinations)
        {
            if (string.IsNullOrWhiteSpace(destination)) return ("DESTINATION_INVALID", "Destination cannot be empty.");
            if (!string.Equals(destination, destination.Trim(), StringComparison.Ordinal)) return ("DESTINATION_INVALID", "Destination cannot contain leading/trailing whitespace.");
            if (destination.Any(char.IsControl)) return ("DESTINATION_INVALID", "Destination cannot contain control characters.");
        }
        if (packet.PayloadRef is null) return ("PAYLOAD_REF_MISSING", "PayloadRef is required.");
        if (!IsAllowedPayloadKind(packet.PayloadRef.Kind)) return ("PAYLOAD_REF_INVALID", "PayloadRef kind is not allowed.");
        if (!IsSafeRelativePath(packet.PayloadRef.Path)) return ("PAYLOAD_REF_INVALID", "PayloadRef path must be relative and safe.");
        return null;
    }

    private static bool IsAllowedPayloadKind(string kind) => kind is "file" or "repoPath" or "artifactStore";

    private static bool IsSafeRelativePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        if (Uri.TryCreate(path, UriKind.Absolute, out _)) return false;
        if (path.StartsWith("/", StringComparison.Ordinal) || path.StartsWith("\\", StringComparison.Ordinal)) return false;
        if (Path.IsPathRooted(path)) return false;
        var segments = path.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
        return !segments.Any(s => s == ".." || s.Contains(':', StringComparison.Ordinal));
    }

    private static bool IsHelp(string arg) => arg is "-h" or "--help" or "help";

    private static void PrintUsage(TextWriter stderr)
    {
        stderr.WriteLine("Usage:");
        stderr.WriteLine("  marketops precheck --packet <PublishPacket.json> [--out <GateResult.json>] [--pretty]");
        stderr.WriteLine("  marketops gate --packet <PublishPacket.json> [--out <GateResult.json>] [--pretty]");
        stderr.WriteLine("Options:");
        stderr.WriteLine("  --packet <path>         Path to PublishPacket JSON");
        stderr.WriteLine("  --out <path>            Output path (default: stdout)");
        stderr.WriteLine("  --pretty                Pretty-print JSON output");
        stderr.WriteLine("  --control-url <url>     Omega SDK base URL (gate only) or set OMEGA_SDK_URL");
        stderr.WriteLine("  --audit-root <path>     Audit root for evidence packs");
        stderr.WriteLine("  --public-key <path>     Public key path for verification");
        stderr.WriteLine("  --trust-bundle <path>   Trust bundle path for verification");
        stderr.WriteLine("  --execute               Enable execution stage (gate only)");
    }

    private static CliOptionsResult ParseOptions(string[] args)
    {
        var options = new CliOptions();
        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            switch (arg)
            {
                case "--packet" or "-p":
                    options.PacketPath = ReadValue(args, ref i, arg);
                    if (options.PacketPath == null) return CliOptionsResult.Fail($"Missing value for {arg}.");
                    break;
                case "--out" or "-o":
                    options.OutPath = ReadValue(args, ref i, arg);
                    if (options.OutPath == null) return CliOptionsResult.Fail($"Missing value for {arg}.");
                    break;
                case "--pretty":
                    options.Pretty = true;
                    break;
                case "--control-url":
                    options.ControlUrl = ReadValue(args, ref i, arg);
                    if (options.ControlUrl == null) return CliOptionsResult.Fail($"Missing value for {arg}.");
                    break;
                case "--audit-root":
                    options.AuditRoot = ReadValue(args, ref i, arg);
                    if (options.AuditRoot == null) return CliOptionsResult.Fail($"Missing value for {arg}.");
                    break;
                case "--public-key":
                    options.PublicKeyPath = ReadValue(args, ref i, arg);
                    if (options.PublicKeyPath == null) return CliOptionsResult.Fail($"Missing value for {arg}.");
                    break;
                case "--trust-bundle":
                    options.TrustBundlePath = ReadValue(args, ref i, arg);
                    if (options.TrustBundlePath == null) return CliOptionsResult.Fail($"Missing value for {arg}.");
                    break;
                case "--execute":
                    options.EnableExecution = true;
                    break;
                default:
                    return CliOptionsResult.Fail($"Unknown argument: {arg}");
            }
        }
        return CliOptionsResult.Ok(options);
    }

    private static string? ReadValue(string[] args, ref int index, string argName)
    {
        if (index + 1 >= args.Length) return null;
        index++;
        return args[index];
    }

    private sealed record CliOptions
    {
        public string? PacketPath { get; set; }
        public string? OutPath { get; set; }
        public bool Pretty { get; set; }
        public string? ControlUrl { get; set; }
        public string? AuditRoot { get; set; }
        public string? PublicKeyPath { get; set; }
        public string? TrustBundlePath { get; set; }
        public bool EnableExecution { get; set; }
    }

    private sealed record CliOptionsResult(bool Success, CliOptions? Options, string? ErrorMessage)
    {
        public static CliOptionsResult Ok(CliOptions options) => new(true, options, null);
        public static CliOptionsResult Fail(string error) => new(false, null, error);
    }
}

public sealed record GateCliReceipt(string Mode, GateResult Result);
