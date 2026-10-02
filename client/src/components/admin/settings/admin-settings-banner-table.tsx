import { useRef, useState, type ChangeEvent } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminBanner } from "@/features/admin/settings/types";

const tableWrapClass = "overflow-x-auto";
const previewWrapClass = "h-16 w-28 overflow-hidden border border-border bg-muted";
const imageClass = "h-full w-full object-cover";
const publicIdTextClass = "max-w-[360px] truncate text-sm text-muted-foreground";
const actionsClass = "flex items-center justify-end gap-2";
const buttonClass = "rounded-none";
const dialogPreviewClass = "aspect-[16/6] w-full overflow-hidden border border-border bg-muted";

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString();
}

type AdminSettingsBannersTableProps = {
  items: AdminBanner[];
  busyId: string;
  onReplace: (id: string, file: File) => void;
  onDelete: (id: string) => Promise<boolean>;
};

function AdminSettingsBannersTable({
  items,
  busyId,
  onReplace,
  onDelete,
}: AdminSettingsBannersTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminBanner | null>(null);

  function pickReplacement(id: string) {
    setReplaceId(id);
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file && replaceId) {
      onReplace(replaceId, file);
    }

    setReplaceId("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const deleted = await onDelete(deleteTarget.id);

    if (deleted) {
      setDeleteTarget(null);
    }
  }

  return (
    <div className={tableWrapClass}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Preview</TableHead>
            <TableHead>Public ID</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {items.map((item) => {
            const isBusy = busyId === item.id;

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className={previewWrapClass}>
                    <a href={item.imageUrl} target="_blank" rel="noreferrer">
                      <img src={item.imageUrl} alt="banner" className={imageClass} />
                    </a>
                  </div>
                </TableCell>

                <TableCell>
                  <p className={publicIdTextClass}>{item.imagePublicId}</p>
                </TableCell>
                <TableCell>
                  <p>{formatDateTime(item.createdAt)}</p>
                </TableCell>
                <TableCell>
                  <div className={actionsClass}>
                    <Button
                      variant="outline"
                      size="sm"
                      className={buttonClass}
                      disabled={Boolean(busyId)}
                      onClick={() => pickReplacement(item.id)}
                    >
                      {isBusy ? <Loader2 className="animate-spin" /> : <ImageUp />}
                      Replace
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className={buttonClass}
                      disabled={Boolean(busyId)}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete banner?</DialogTitle>
            <DialogDescription>
              The banner will be removed from the homepage and its image deleted. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className={dialogPreviewClass}>
              <img src={deleteTarget.imageUrl} alt="banner" className={imageClass} />
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className={buttonClass} disabled={Boolean(busyId)}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className={buttonClass}
              disabled={Boolean(busyId)}
              onClick={() => void confirmDelete()}
            >
              {busyId && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminSettingsBannersTable;
