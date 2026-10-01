/*
 * Account: the signed-in customer's page in the website's phone layout — the profile card with
 * the tabs as a row of chips, then Overview / Orders / Rentals / Wishlist / Addresses / Payment
 * methods / Settings (src/components/account/*), then the "Need a hand?" card.
 * `/account?tab=wishlist` opens a tab directly; switching tabs keeps the param in step.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { C, GUTTER } from "@/theme";
import { SITE_URL } from "@/lib/api";
import { clearCatalogCache, getNotifications, listAddresses, listOrders, listPaymentMethods, listProducts } from "@/lib/catalog";
import { api, auth, bootstrap, headerVals, navigate, storeVals, useShop } from "@/lib/store";
import type { AddressDTO, OrderDTO, PaymentMethodDTO, ProductDTO, UserDTO } from "@/lib/types";
import { Screen } from "@/components/Screen";
import { H, Icon, ICON, LoadError, Loading, T, Tap, useLoad } from "@/components/ui";
import { AI, DAY, dayNo, errText, isAccountTab, rentalGroups, yearOf, type Account, type AccountTab, type OrderFilter, type OrderItem, type RentFilter } from "@/components/account/shared";
import { OverviewTab } from "@/components/account/OverviewTab";
import { OrdersTab } from "@/components/account/OrdersTab";
import { RentalsTab } from "@/components/account/RentalsTab";
import { WishlistTab } from "@/components/account/WishlistTab";
import { AddressesTab } from "@/components/account/AddressesTab";
import { PaymentTab } from "@/components/account/PaymentTab";
import { SettingsTab } from "@/components/account/SettingsTab";

type AccountData = {
  orders: OrderDTO[];
  addresses: AddressDTO[];
  products: ProductDTO[];
  paymentMethods: PaymentMethodDTO[];
  notifications: Record<string, boolean> | null;
  /** when the data was loaded (ISO timestamp) */
  today: string;
};

const NOTIF_DEFAULT = { sms: true, email: true, remind: true, deals: false };

export default function AccountScreen() {
  const shop = useShop();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: AccountTab = isAccountTab(rawTab) ? rawTab : "overview";
  const user = shop.user;
  const userId = user ? user.id : null;
  const leaving = useRef(false); // signing out: go home instead of to the sign-in page

  // The page needs a signed-in customer.
  const signedOut = shop.ready && !shop.bootError && !user;
  const next = "/account" + (isAccountTab(rawTab) ? "?tab=" + rawTab : "");
  useEffect(() => {
    if (signedOut && !leaving.current) navigate("/signin?next=" + encodeURIComponent(next), { replace: true });
  }, [signedOut, next]);

  const { data, error, loading, reload } = useLoad<AccountData | null>(async () => {
    if (!userId) return null;
    const [orders, addresses, products, paymentMethods, notifications] = await Promise.all([listOrders(), listAddresses(), listProducts(), listPaymentMethods(), getNotifications()]);
    return { orders, addresses, products, paymentMethods, notifications, today: new Date().toISOString() };
  }, [userId]);

  // Coming back to this screen (from the payment page, an order, a product …) refreshes the data.
  const refresh = useRef(reload);
  const visited = useRef(false);
  useEffect(() => {
    refresh.current = reload;
  });
  useFocusEffect(
    useCallback(() => {
      if (visited.current) refresh.current();
      visited.current = true;
    }, []),
  );

  const signOut = () => {
    leaving.current = true;
    const goHome = () => (router.canDismiss() ? router.dismissAll() : navigate("/", { replace: true }));
    auth.signOut().then(goHome, goHome);
  };

  return (
    <Screen
      onRefresh={async () => {
        clearCatalogCache();
        reload();
        await bootstrap();
      }}
    >
      {shop.bootError && !user ? (
        <LoadError message={shop.bootError} onRetry={bootstrap} />
      ) : user && data ? (
        <AccountBody data={data} user={user} tab={tab} onSignOut={signOut} />
      ) : !user || loading ? (
        <Loading />
      ) : (
        <LoadError message={error} onRetry={reload} />
      )}
    </Screen>
  );
}

function AccountBody({ data, user, tab, onSignOut }: { data: AccountData; user: UserDTO; tab: AccountTab; onSignOut: () => void }) {
  const shop = useShop();
  const store = storeVals(shop);
  const hv = headerVals(shop);

  // What the tabs change. A fresh load (pull to refresh, coming back) replaces it.
  const [loaded, setLoaded] = useState(data);
  const [orders, setOrders] = useState(data.orders);
  const [addresses, setAddresses] = useState(data.addresses);
  const [methods, setMethods] = useState(data.paymentMethods);
  const [notif, setNotif] = useState<Record<string, boolean>>({ ...NOTIF_DEFAULT, ...(data.notifications || {}) });
  if (loaded !== data) {
    setLoaded(data);
    setOrders(data.orders);
    setAddresses(data.addresses);
    setMethods(data.paymentMethods);
    setNotif({ ...NOTIF_DEFAULT, ...(data.notifications || {}) });
  }
  const [orderTab, setOrderTab] = useState<OrderFilter>("all");
  const [openOrder, setOpenOrder] = useState<string | null>(data.orders.length ? data.orders[0].id : null);
  const [rentTab, setRentTab] = useState<RentFilter>("active");
  const [pickup, setPickup] = useState<Record<number, boolean>>({});
  const [extBusy, setExtBusy] = useState<number | null>(null);
  const [extError, setExtError] = useState<{ id: number; message: string } | null>(null);

  // Extend a rental by a day: the API charges the day rate; the order shown here is updated to match.
  const extend = (itemId: number) => {
    if (extBusy) return;
    setExtBusy(itemId);
    setExtError(null);
    api<{ charge?: number }>("POST", "/api/rentals/" + itemId + "/extend", { days: 1 }).then(
      (res) => {
        const charge = (res && res.charge) || 0;
        setOrders((list) =>
          list.map((o) => {
            if (!o.items.some((i: OrderItem) => i.id === itemId)) return o;
            return {
              ...o,
              totals: { ...o.totals, rentals: o.totals.rentals + charge, total: o.totals.total + charge },
              items: o.items.map((i: OrderItem) =>
                i.id !== itemId
                  ? i
                  : {
                      ...i,
                      rentEnd: i.rentEnd ? new Date(Date.parse(i.rentEnd) + DAY).toISOString() : i.rentEnd,
                      rentDays: (i.rentDays || 0) + 1,
                      extendedDays: (i.extendedDays || 0) + 1,
                      extraCharge: (i.extraCharge || 0) + charge,
                    },
              ),
            };
          }),
        );
        setExtBusy(null);
      },
      (err) => {
        setExtBusy(null);
        setExtError({ id: itemId, message: errText(err) });
      },
    );
  };

  const today = dayNo(data.today);
  const rentals = rentalGroups(orders, today);
  const a: Account = {
    user,
    today,
    todayISO: data.today,
    products: data.products,
    orders,
    rentals,
    goTab: (id) => router.setParams({ tab: id }),
    orderTab,
    setOrderTab,
    openOrder,
    setOpenOrder,
    rentTab,
    setRentTab,
    pickup,
    togglePickup: (id) => setPickup((p) => ({ ...p, [id]: !p[id] })),
    extBusy,
    extError,
    extend,
    addresses,
    setAddresses,
    methods,
    setMethods,
    notif,
    setNotif,
  };

  const onTheWay = orders.filter((o) => o.status === "PACKED" || o.status === "OUT_FOR_DELIVERY").length;
  const chips: { id: AccountTab; label: string; icon: string; badge?: { text: string; bg?: string } }[] = [
    { id: "overview", label: "Overview", icon: AI.overview },
    { id: "orders", label: "Orders", icon: AI.orders, badge: { text: String(onTheWay), bg: C.navy } },
    { id: "rentals", label: "Rentals", icon: ICON.calendar, badge: { text: String(rentals.current.length), bg: C.green } },
    { id: "wishlist", label: "Wishlist", icon: ICON.heart, badge: { text: String(hv.wishCount) } },
    { id: "addresses", label: "Addresses", icon: ICON.pin },
    { id: "payment", label: "Payment methods", icon: AI.payment },
    { id: "settings", label: "Settings", icon: AI.settings },
  ];

  // Keep the active chip in view (the row scrolls sideways).
  const nav = useRef<ScrollView>(null);
  const chipX = useRef<Record<string, number>>({});
  const showChip = (id: string, animated: boolean) => {
    const x = chipX.current[id];
    if (x != null) nav.current?.scrollTo({ x: Math.max(0, x - GUTTER), animated });
  };
  useEffect(() => {
    showChip(tab, true);
  }, [tab]);

  const isStaff = !!(user as UserDTO & { isStaff?: boolean }).isStaff;
  const storeTel = "tel:" + String(store.phone || "").replace(/[^\d+]/g, "");

  return (
    <View style={{ paddingTop: 40, paddingHorizontal: GUTTER, gap: 24 }}>
      {/* profile + tabs */}
      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 28, padding: 16, gap: 14, backgroundColor: C.white, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 8, paddingTop: 4 }}>
          <View style={{ width: 60, height: 60, borderRadius: 999, backgroundColor: C.navy, alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px " + C.sky }}>
            <H s={18} lh={22} ls={0} c={C.white}>
              {hv.userInitials}
            </H>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <H s={21} lh={25} ls={-0.63} numberOfLines={2}>
              {user.name}
            </H>
            <T s={13} c={C.muted}>
              {"Member since " + yearOf(user.createdAt || data.today)}
            </T>
          </View>
        </View>
        <ScrollView ref={nav} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel="Account" style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4, gap: 8 }}>
          {chips.map((chip) => {
            const on = chip.id === tab;
            const fg = on ? C.navy : C.text;
            return (
              <Tap
                key={chip.id}
                onPress={() => a.goTab(chip.id)}
                onLayout={(e) => {
                  chipX.current[chip.id] = e.nativeEvent.layout.x;
                  if (on) showChip(chip.id, false);
                }}
                hitSlop={2}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ height: 40, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, borderRadius: 999, backgroundColor: on ? C.sky : "transparent", flexDirection: "row", alignItems: "center", gap: 8 }}
                pressedStyle={{ backgroundColor: on ? C.sky : "#F6F5F1" }}
              >
                <Icon xml={chip.icon} size={19} color={fg} sw={1.8} />
                <T s={15} w={600} c={fg}>
                  {chip.label}
                </T>
                {chip.badge ? (
                  chip.badge.bg ? (
                    <View style={{ minWidth: 24, height: 22, paddingHorizontal: 7, marginLeft: 2, borderRadius: 999, backgroundColor: chip.badge.bg, alignItems: "center", justifyContent: "center" }}>
                      <T s={12} w={700} c={C.white} lh={15}>
                        {chip.badge.text}
                      </T>
                    </View>
                  ) : (
                    <T s={13} w={600} c={C.muted} style={{ marginLeft: 2 }}>
                      {chip.badge.text}
                    </T>
                  )
                ) : null}
              </Tap>
            );
          })}
          {isStaff ? <LinkChip title="Store admin" icon={AI.admin} color={C.navy} onPress={() => Linking.openURL(SITE_URL + "/admin")} /> : null}
          <LinkChip title="Sign out" icon={AI.signOut} color="#B02418" onPress={onSignOut} />
        </ScrollView>
      </View>

      <View style={{ gap: 40 }}>
        {tab === "overview" ? <OverviewTab a={a} /> : null}
        {tab === "orders" ? <OrdersTab a={a} /> : null}
        {tab === "rentals" ? <RentalsTab a={a} /> : null}
        {tab === "wishlist" ? <WishlistTab a={a} /> : null}
        {tab === "addresses" ? <AddressesTab a={a} /> : null}
        {tab === "payment" ? <PaymentTab a={a} /> : null}
        {tab === "settings" ? <SettingsTab a={a} /> : null}
      </View>

      {/* support */}
      <View style={{ borderRadius: 24, backgroundColor: "#F6F5F1", padding: 22, gap: 12, alignItems: "flex-start" }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
          <Icon xml={AI.headset} size={20} color={C.navy} sw={1.8} />
        </View>
        <T s={16} w={700}>
          Need a hand?
        </T>
        <T s={14} c={C.muted} lh={21}>
          {"Our team can change a delivery, extend a rental or sort a return. Call "}
          <T s={14} w={700} c={C.navy} lh={21} onPress={() => Linking.openURL(storeTel)} accessibilityRole="link">
            {store.phone}
          </T>
          .
        </T>
        <Tap href="/p/contact">
          <T s={14} w={700} c={C.navy} style={{ textDecorationLine: "underline" }}>
            Chat with support
          </T>
        </Tap>
      </View>
    </View>
  );
}

/** A chip at the end of the tab row that leaves the page (sign out, store admin). */
function LinkChip({ title, icon, color, onPress }: { title: string; icon: string; color: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} hitSlop={2} style={{ height: 40, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8 }} pressedStyle={{ backgroundColor: "#F6F5F1" }}>
      <Icon xml={icon} size={19} color={color} sw={1.8} />
      <T s={15} w={600} c={color}>
        {title}
      </T>
    </Tap>
  );
}
