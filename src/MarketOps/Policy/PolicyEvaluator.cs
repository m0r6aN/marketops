using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MarketOps.Ports;

namespace MarketOps.Policy;

/// <summary>
/// Evaluates governance policies for side effect intents.
/// Denies/gates intents that:
/// - Target direct push to main
/// - Weaken CI/workflow permissions
/// </summary>
public sealed class PolicyEvaluator
{
    private readonly Action<string>? _auditLog;

    public PolicyEvaluator(Action<string>? auditLog = null)
    {
        _auditLog = auditLog;
    }

    /// <summary>
    /// Evaluates a list of intents against policies.
    /// Returns approval result with any denial reasons.
    /// </summary>
    public async Task<PolicyEvaluationResult> EvaluateAsync(
        List<SideEffectIntent> intents,
        CancellationToken ct = default)
    {
        _auditLog?.Invoke($"POLICY_EVAL_START intent_count={intents.Count}");

        var denialReasons = new List<string>();

        foreach (var intent in intents)
        {
            // Check for direct push to main
            if (IsDirectPushToMain(intent))
            {
                denialReasons.Add($"Intent {intent.Id} targets direct push to main (blocked by policy)");
                _auditLog?.Invoke($"POLICY_DENY intent_id={intent.Id} reason=direct_push_to_main");
            }

            // Check for CI weakening
            if (WeakensCi(intent))
            {
                denialReasons.Add($"Intent {intent.Id} weakens CI/workflow permissions (blocked by policy)");
                _auditLog?.Invoke($"POLICY_DENY intent_id={intent.Id} reason=weakens_ci");
            }
        }

        var isApproved = denialReasons.Count == 0;
        _auditLog?.Invoke($"POLICY_EVAL_END approved={isApproved} denials={denialReasons.Count}");

        return new PolicyEvaluationResult(
            IsApproved: isApproved,
            DenialReasons: denialReasons);
    }

    private bool IsDirectPushToMain(SideEffectIntent intent)
    {
        // Check if target contains "main" and effect type is not OpenPr
        if (intent.Target.Contains("main", StringComparison.OrdinalIgnoreCase))
        {
            if (intent.EffectType != SideEffectType.OpenPr)
            {
                return true;
            }
        }

        // Check parameters for branch targeting
        if (intent.Parameters.TryGetValue("branch", out var branch))
        {
            if (branch?.ToString()?.Equals("main", StringComparison.OrdinalIgnoreCase) == true)
            {
                if (intent.EffectType != SideEffectType.OpenPr)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private bool WeakensCi(SideEffectIntent intent)
    {
        // Check if intent modifies CI/workflow files in a way that weakens security
        if (intent.Target.Contains(".github/workflows", StringComparison.OrdinalIgnoreCase))
        {
            // Check if parameters indicate removal or weakening
            if (intent.Parameters.TryGetValue("action", out var action))
            {
                var actionStr = action?.ToString()?.ToLowerInvariant();
                if (actionStr == "remove" || actionStr == "weaken" || actionStr == "disable")
                {
                    return true;
                }
            }
        }

        return false;
    }
}

/// <summary>
/// Result of policy evaluation.
/// </summary>
public sealed record PolicyEvaluationResult(
    bool IsApproved,
    List<string> DenialReasons);

