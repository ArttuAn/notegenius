import { NotebookWorkspace } from "@/components/notebook/NotebookWorkspace";

type Props = { params: Promise<{ id: string }> };

export default async function NotebookPage({ params }: Props) {
  const { id } = await params;
  return <NotebookWorkspace notebookId={id} />;
}
