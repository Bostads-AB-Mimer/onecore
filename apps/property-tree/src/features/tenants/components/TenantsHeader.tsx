// import { SaveAsFavoriteButton } from "@/components/shared/SaveAsFavoriteButton";
// import { ActiveFavoriteIndicator } from "@/components/shared/ActiveFavoriteIndicator";

export function TenantsHeader() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Alla kunder</h1>
          <p className="text-muted-foreground">
            Sammanställning av alla kunder i systemet, både privatpersoner och
            företag.
          </p>
        </div>
        {/* <SaveAsFavoriteButton
          category="tenants"
          pageTitle="Alla kunder"
          defaultName="Min kundvy"
          icon="👤"
        /> */}
      </div>
      {/* <ActiveFavoriteIndicator /> */}
    </>
  )
}
