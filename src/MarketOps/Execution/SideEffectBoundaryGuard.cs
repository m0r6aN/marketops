using System;
using System.Threading;

namespace MarketOps.Execution;

public static class SideEffectBoundaryGuard
{
    private static readonly AsyncLocal<int> ScopeDepth = new();

    public static IDisposable EnterPortScope()
    {
        ScopeDepth.Value++;
        return new ScopeHandle();
    }

    public static void AssertInsidePort(string operationName)
    {
        if (ScopeDepth.Value <= 0)
            throw new InvalidOperationException($"Side effect '{operationName}' attempted outside SideEffectPort boundary.");
    }

    private sealed class ScopeHandle : IDisposable
    {
        private bool _disposed;

        public void Dispose()
        {
            if (_disposed)
                return;

            ScopeDepth.Value = Math.Max(0, ScopeDepth.Value - 1);
            _disposed = true;
        }
    }
}
