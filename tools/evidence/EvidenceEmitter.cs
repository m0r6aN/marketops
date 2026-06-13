// EvidenceEmitter.cs

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

public class EvidenceEmitter
{
    private readonly BlobServiceClient _blobService;

    public EvidenceEmitter(string connectionString)
    {
        _blobService = new BlobServiceClient(connectionString);
    }

    public async Task<dynamic> BeginRun(dynamic descriptor)
    {
        string runId = $"run_{Guid.NewGuid()}";
        string timestamp = DateTime.UtcNow.ToString("o");

        string prefix = $"{descriptor.env}/{descriptor.layer}/{descriptor.suite}/{descriptor.scenarioId}/{runId}";

        var container = _blobService.GetBlobContainerClient(descriptor.storage.container);

        return new
        {
            descriptor,
            runId,
            timestamp,
            prefix,
            container,
            artifacts = new List<object>(),
            assertions = new List<object>(),
            status = "pass",
            failure = (object)null
        };
    }

    public async Task<object> EmitArtifact(dynamic handle, string name, byte[] data, string contentType)
    {
        using var sha = SHA256.Create();
        string hash = Convert.ToHexString(sha.ComputeHash(data)).ToLower();

        var blob = handle.container.GetBlobClient($"{handle.prefix}/{name}");
        await blob.UploadAsync(new BinaryData(data), overwrite: true);

        var descriptor = new
        {
            name,
            blobUrl = blob.Uri.ToString(),
            sha256 = hash,
            bytes = data.Length
        };

        handle.artifacts.Add(descriptor);
        return descriptor;
    }

    public async Task<object> FinalizeRun(dynamic handle)
    {
        var manifest = new
        {
            schemaVersion = "v1.0.0",
            runId = handle.runId,
            timestamp = handle.timestamp,
            env = handle.descriptor.env,
            layer = handle.descriptor.layer,
            suite = handle.descriptor.suite,
            scenarioId = handle.descriptor.scenarioId,
            status = handle.status,
            source = handle.descriptor.source,
            assertions = handle.assertions,
            failure = handle.failure,
            evidence = new
            {
                storage = new
                {
                    account = "keonreceipts",
                    container = handle.descriptor.storage.container,
                    prefix = handle.prefix
                },
                artifacts = handle.artifacts
            }
        };

        string json = JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true });
        byte[] data = Encoding.UTF8.GetBytes(json);

        using var sha = SHA256.Create();
        string hash = Convert.ToHexString(sha.ComputeHash(data)).ToLower();

        var blob = handle.container.GetBlobClient($"{handle.prefix}/run_manifest.json");
        await blob.UploadAsync(new BinaryData(data), overwrite: true);

        return new { handle.runId, manifestUrl = blob.Uri.ToString(), sha256 = hash };
    }
}
