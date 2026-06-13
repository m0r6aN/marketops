import { ImportForm } from "@/components/library/import-form";

export default function LibraryImportPage() {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-base font-semibold">New Import</h2>
        <p className="text-sm text-muted-foreground">
          Upload files to extract canon, marketing copy, internal knowledge, and identify noise.
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
