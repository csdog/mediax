import { Globe } from "lucide-react";

export function NewTabPage() {
  return (
    <main className="new-tab-page">
      <div className="new-tab-content">
        <div className="new-tab-hero">
          <Globe className="new-tab-hero-icon" aria-hidden />
          <h1 className="text-lg font-medium">新标签页</h1>
        </div>
      </div>
    </main>
  );
}
