import { useDraft } from "./state/draftStore";
import { HomePage } from "./pages/HomePage";
import { SetupPage } from "./pages/SetupPage";
import { DraftRoom } from "./pages/DraftRoom";
import { ResultsPage } from "./pages/ResultsPage";

export default function App() {
  const { screen } = useDraft();
  if (screen === "setup") return <SetupPage />;
  if (screen === "draft") return <DraftRoom />;
  if (screen === "results") return <ResultsPage />;
  return <HomePage />;
}
