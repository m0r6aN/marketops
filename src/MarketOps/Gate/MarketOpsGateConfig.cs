using System;
using System.Collections.Generic;
using System.Linq;

namespace MarketOps.Gate;

public sealed record MarketOpsGateOverrides(
    string? TenantId = null,
    string? ActorId = null,
    IReadOnlyList<string>? Allowlist = null,
    string? Capability = null,
    string? AuditRoot = null,
    string? PublicKeyPath = null,
    string? TrustBundlePath = null,
    string? ExecutionTargetKind = null,
    string? ExecutionTargetName = null,
    string? ExecutionTargetVersion = null);

public sealed record MarketOpsGateConfig(
    string TenantId,
    string ActorId,
    IReadOnlyList<string> Allowlist,
    string Capability,
    string AuditRoot,
    string? PublicKeyPath,
    string? TrustBundlePath,
    string ExecutionTargetKind,
    string? ExecutionTargetName,
    string? ExecutionTargetVersion)
{
    public static MarketOpsGateConfig Build(MarketOpsGateOverrides? overrides, Action<string>? auditLog = null)
    {
        var tenantId = "keon-public";
        var actorId = "operator-marketops";
        var allowlist = new List<string>
        {
            "keon.systems/site-docs",
            "keon.systems/public-artifacts",
            "github:keon-systems/docs",
            "github:keon-systems/specs",
            "github:keon-systems/sdk-releases",
            "diagrams:keon-systems/public"
        };
        var capability = "marketops.publish";
        var auditRoot = ".";
        string? publicKeyPath = null;
        string? trustBundlePath = null;
        var executionTargetKind = "publish";
        string? executionTargetName = "marketops";
        string? executionTargetVersion = "v0";

        if (overrides != null)
        {
            if (!string.IsNullOrWhiteSpace(overrides.TenantId) && overrides.TenantId != tenantId)
            {
                auditLog?.Invoke($"MARKETOPS_OVERRIDE tenantId {tenantId} -> {overrides.TenantId}");
                tenantId = overrides.TenantId;
            }

            if (!string.IsNullOrWhiteSpace(overrides.ActorId) && overrides.ActorId != actorId)
            {
                auditLog?.Invoke($"MARKETOPS_OVERRIDE actorId {actorId} -> {overrides.ActorId}");
                actorId = overrides.ActorId;
            }

            if (overrides.Allowlist != null)
            {
                if (overrides.Allowlist.Count == 0)
                    throw new InvalidOperationException("Allowlist override cannot be empty.");

                auditLog?.Invoke("MARKETOPS_OVERRIDE allowlist");
                allowlist = new List<string>(overrides.Allowlist);
            }

            if (!string.IsNullOrWhiteSpace(overrides.Capability) && overrides.Capability != capability)
            {
                auditLog?.Invoke($"MARKETOPS_OVERRIDE capability {capability} -> {overrides.Capability}");
                capability = overrides.Capability;
            }

            if (!string.IsNullOrWhiteSpace(overrides.AuditRoot) && overrides.AuditRoot != auditRoot)
            {
                auditLog?.Invoke($"MARKETOPS_OVERRIDE auditRoot {auditRoot} -> {overrides.AuditRoot}");
                auditRoot = overrides.AuditRoot;
            }

            if (!string.IsNullOrWhiteSpace(overrides.PublicKeyPath))
            {
                auditLog?.Invoke("MARKETOPS_OVERRIDE publicKeyPath");
                publicKeyPath = overrides.PublicKeyPath;
            }

            if (!string.IsNullOrWhiteSpace(overrides.TrustBundlePath))
            {
                auditLog?.Invoke("MARKETOPS_OVERRIDE trustBundlePath");
                trustBundlePath = overrides.TrustBundlePath;
            }

            if (!string.IsNullOrWhiteSpace(overrides.ExecutionTargetKind) && overrides.ExecutionTargetKind != executionTargetKind)
            {
                auditLog?.Invoke($"MARKETOPS_OVERRIDE executionTargetKind {executionTargetKind} -> {overrides.ExecutionTargetKind}");
                executionTargetKind = overrides.ExecutionTargetKind;
            }

            if (!string.IsNullOrWhiteSpace(overrides.ExecutionTargetName) && overrides.ExecutionTargetName != executionTargetName)
            {
                auditLog?.Invoke($"MARKETOPS_OVERRIDE executionTargetName {executionTargetName} -> {overrides.ExecutionTargetName}");
                executionTargetName = overrides.ExecutionTargetName;
            }

            if (!string.IsNullOrWhiteSpace(overrides.ExecutionTargetVersion) && overrides.ExecutionTargetVersion != executionTargetVersion)
            {
                auditLog?.Invoke($"MARKETOPS_OVERRIDE executionTargetVersion {executionTargetVersion} -> {overrides.ExecutionTargetVersion}");
                executionTargetVersion = overrides.ExecutionTargetVersion;
            }
        }

        var config = new MarketOpsGateConfig(
            tenantId,
            actorId,
            allowlist.AsReadOnly(),
            capability,
            auditRoot,
            publicKeyPath,
            trustBundlePath,
            executionTargetKind,
            executionTargetName,
            executionTargetVersion);

        config.Validate();
        return config;
    }

    public bool IsDestinationAllowed(string destination)
        => Allowlist.Contains(destination, StringComparer.Ordinal);

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(TenantId))
            throw new InvalidOperationException("TenantId must be set.");
        if (string.IsNullOrWhiteSpace(ActorId))
            throw new InvalidOperationException("ActorId must be set.");
        if (Allowlist == null || Allowlist.Count == 0)
            throw new InvalidOperationException("At least one destination must be allowlisted.");
        if (string.IsNullOrWhiteSpace(ExecutionTargetKind))
            throw new InvalidOperationException("ExecutionTargetKind must be set.");
    }
}
