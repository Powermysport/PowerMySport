"use client";

import { Tabs } from "@/modules/shared/ui/Tabs";
import { usePathname, useRouter } from "next/navigation";

const SHOP_TABS = [
  { id: "/admin/products", label: "Products" },
  { id: "/admin/orders", label: "Orders" },
  { id: "/admin/promo-codes", label: "Promo codes" },
] as const;

type ShopTab = (typeof SHOP_TABS)[number]["id"];

/**
 * The shop is one sidebar entry; its three pages are tabs. Each keeps its own
 * route so links, bookmarks and the browser back button still work.
 */
export function ShopTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const value: ShopTab =
    SHOP_TABS.find((tab) => pathname.startsWith(tab.id))?.id ?? "/admin/products";

  return (
    <Tabs
      label="Shop"
      value={value}
      onChange={(next) => router.push(next)}
      tabs={SHOP_TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
    />
  );
}
