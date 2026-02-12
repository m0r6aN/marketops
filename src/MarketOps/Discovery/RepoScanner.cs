using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MarketOps.Discovery;

/// <summary>
/// Scans local repositories for hygiene issues.
/// Checks for: README sections, CODEOWNERS, .editorconfig
/// </summary>
public sealed class RepoScanner
{
    private readonly Action<string>? _auditLog;

    public RepoScanner(Action<string>? auditLog = null)
    {
        _auditLog = auditLog;
    }

    /// <summary>
    /// Scans a repository for hygiene findings.
    /// </summary>
    public async Task<List<HygieneIssue>> ScanAsync(
        string repoPath,
        CancellationToken ct = default)
    {
        var issues = new List<HygieneIssue>();

        if (!Directory.Exists(repoPath))
        {
            _auditLog?.Invoke($"SCAN_SKIP repo_path={repoPath} reason=not_found");
            return issues;
        }

        _auditLog?.Invoke($"SCAN_START repo_path={repoPath}");

        // Check README
        var readmeIssue = CheckReadme(repoPath);
        if (readmeIssue != null)
            issues.Add(readmeIssue);

        // Check CODEOWNERS
        var codeownersIssue = CheckCodeowners(repoPath);
        if (codeownersIssue != null)
            issues.Add(codeownersIssue);

        // Check .editorconfig
        var editorconfigIssue = CheckEditorconfig(repoPath);
        if (editorconfigIssue != null)
            issues.Add(editorconfigIssue);

        _auditLog?.Invoke($"SCAN_END repo_path={repoPath} issues={issues.Count}");
        return issues;
    }

    private HygieneIssue? CheckReadme(string repoPath)
    {
        var readmePath = Path.Combine(repoPath, "README.md");
        if (!File.Exists(readmePath))
        {
            return new HygieneIssue(
                Type: "missing_readme",
                RepoPath: repoPath,
                FilePath: "README.md",
                Description: "README.md is missing",
                Severity: "high");
        }

        var content = File.ReadAllText(readmePath);
        var requiredSections = new[] { "## Installation", "## Usage", "## License" };
        var missingSections = requiredSections.Where(s => !content.Contains(s)).ToList();

        if (missingSections.Any())
        {
            return new HygieneIssue(
                Type: "incomplete_readme",
                RepoPath: repoPath,
                FilePath: "README.md",
                Description: $"README.md missing sections: {string.Join(", ", missingSections)}",
                Severity: "medium");
        }

        return null;
    }

    private HygieneIssue? CheckCodeowners(string repoPath)
    {
        var codeownersPath = Path.Combine(repoPath, "CODEOWNERS");
        if (!File.Exists(codeownersPath))
        {
            return new HygieneIssue(
                Type: "missing_codeowners",
                RepoPath: repoPath,
                FilePath: "CODEOWNERS",
                Description: "CODEOWNERS file is missing",
                Severity: "high");
        }

        return null;
    }

    private HygieneIssue? CheckEditorconfig(string repoPath)
    {
        var editorconfigPath = Path.Combine(repoPath, ".editorconfig");
        if (!File.Exists(editorconfigPath))
        {
            return new HygieneIssue(
                Type: "missing_editorconfig",
                RepoPath: repoPath,
                FilePath: ".editorconfig",
                Description: ".editorconfig file is missing",
                Severity: "low");
        }

        return null;
    }
}

/// <summary>
/// Represents a hygiene issue found during scanning.
/// </summary>
public sealed record HygieneIssue(
    string Type,
    string RepoPath,
    string FilePath,
    string Description,
    string Severity);

