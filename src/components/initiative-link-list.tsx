type InitiativeLinkListProps = {
  publicUrl?: string;
  repoUrl?: string;
};

export function InitiativeLinkList({ publicUrl, repoUrl }: InitiativeLinkListProps) {
  if (!publicUrl && !repoUrl) return null;

  return (
    <div className="flex flex-wrap gap-4">
      {publicUrl && (
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Public site
        </a>
      )}
      {repoUrl && (
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Repository
        </a>
      )}
    </div>
  );
}
