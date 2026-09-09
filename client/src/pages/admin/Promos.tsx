import PromoDialog from "@/components/admin/promos/promo-dialog";
import PromoToolbar from "@/components/admin/promos/promo-toolbar";
import PromoTable from "@/components/admin/promos/promos-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminPromos } from "@/features/admin/promo/use-admin-promo";

const pageWrapClass = "space-y-6 p-6";

const cardClass = "border-border bg-card shadow-sm";

const cardHeaderClass = "space-y-4";

const cardTitleClass = "text-xl";

function AdminPromos() {
  const {
    search,
    setSearch,
    promos,
    loading,
    promoDialogOpen,
    setPromoDialogOpen,
    editingPromo,
    openCreateDialog,
    closePromoDialog,
    savePromo,
    removePromo,
    saving,
    deletingPromoId,
    openEditDialog,
  } = useAdminPromos();

  return (
    <div className={pageWrapClass}>
      <Card className={cardClass}>
        <CardHeader className={cardHeaderClass}>
          <CardTitle className={cardTitleClass}>Promos</CardTitle>
          <PromoToolbar search={search} onSearchChange={setSearch} onAddPromo={openCreateDialog} />
        </CardHeader>

        <CardContent>
          <PromoTable
            promos={promos}
            loading={loading}
            deletingPromoId={deletingPromoId}
            onEdit={openEditDialog}
            onDelete={removePromo}
          />
        </CardContent>
      </Card>

      <PromoDialog
        open={promoDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePromoDialog();
            return;
          }
          setPromoDialogOpen(true);
        }}
        promo={editingPromo}
        saving={saving}
        onSaved={savePromo}
      />
    </div>
  );
}

export default AdminPromos;
