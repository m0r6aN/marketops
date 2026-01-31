using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using MarketOps.Cli;
using MarketOps.Contracts;
using Xunit;

namespace MarketOps.Cli.Tests;

public sealed class CliSmokeTests
{
    [Fact]
    public async Task Precheck_ShouldPass_OnValidPacket()
    {
        var packet = MakePacket();
        var path = WritePacket(packet);
        using var stdout = new StringWriter();
        using var stderr = new StringWriter();

        var exit = await Program.RunAsync(new[] { "precheck", "--packet", path }, stdout, stderr);
        var output = stdout.ToString();

        Assert.Equal(0, exit);
        Assert.Contains("\"mode\":\"precheck\"", output, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"result\"", output, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"allowed\":true", output, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"packetHashSha256\"", output, StringComparison.OrdinalIgnoreCase);

        var receipt = JsonSerializer.Deserialize<GateCliReceipt>(
            output,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(receipt);
        Assert.Equal("precheck", receipt.Mode);
        Assert.True(receipt.Result.Allowed);
        Assert.False(string.IsNullOrWhiteSpace(receipt.Result.PacketHashSha256));
        File.Delete(path);
    }

    [Fact]
    public async Task Precheck_ShouldDeny_OnUnknownDestination()
    {
        var packet = MakePacket(destinations: new[] { "github:somewhere-else/private" });
        var path = WritePacket(packet);
        using var stdout = new StringWriter();
        using var stderr = new StringWriter();

        var exit = await Program.RunAsync(new[] { "precheck", "--packet", path }, stdout, stderr);
        var output = stdout.ToString();

        Assert.Equal(1, exit);
        Assert.Contains("\"mode\":\"precheck\"", output, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"allowed\":false", output, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"FailureStage\":0", output);
        Assert.Contains("\"denialCode\"", output, StringComparison.OrdinalIgnoreCase);

        var receipt = JsonSerializer.Deserialize<GateCliReceipt>(
            output,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(receipt);
        Assert.False(receipt.Result.Allowed);
        Assert.Equal(FailureStage.Precheck, receipt.Result.FailureStage);
        Assert.Equal("DESTINATION_NOT_ALLOWED", receipt.Result.DenialCode);
        File.Delete(path);
    }

    [Fact]
    public async Task Gate_ShouldError_WithoutControlUrl()
    {
        var packet = MakePacket();
        var path = WritePacket(packet);
        using var stdout = new StringWriter();
        using var stderr = new StringWriter();

        var exit = await Program.RunAsync(new[] { "gate", "--packet", path }, stdout, stderr);

        Assert.Equal(3, exit);
        var err = stderr.ToString();
        Assert.Contains("KEON_CONTROL_URL", err, StringComparison.Ordinal);
        File.Delete(path);
    }

    private static string WritePacket(PublishPacket packet)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var json = JsonSerializer.Serialize(packet, options);
        var path = Path.GetTempFileName();
        File.WriteAllText(path, json);
        return path;
    }

    private static PublishPacket MakePacket(IReadOnlyList<string>? destinations = null)
    {
        return new PublishPacket(
            ArtifactId: "artifact-123",
            ArtifactType: "technical",
            CreatedAtUtc: DateTimeOffset.UtcNow,
            TenantId: "keon-public",
            CorrelationId: "t:keon-public|c:01923e6a-46a9-77f2-9cba-9c9f2f8a8f7c",
            ActorId: "operator-marketops",
            SourceRefs: new[] { "github:keon-systems/docs#readme" },
            PayloadRef: new PayloadRef("file", "public/readme.md"),
            Destinations: destinations ?? new[] { "keon.systems/site-docs" });
    }
}
