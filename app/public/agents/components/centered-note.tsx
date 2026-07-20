export function CenteredNote({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <div className="max-w-sm space-y-2 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
