/*
 * The site chrome at the top of every page, in its phone layout: the "Deliver to" strip, the
 * header (logo, All categories, account, wishlist, cart), the search box with the Buy / Rent
 * toggle, and the department row.
 */
import React, { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { C, F, GUTTER } from "@/theme";
import { headerVals, navigate, searchHref, storeVals, useShop } from "@/lib/store";
import { openCategoryMenu } from "@/lib/ui-state";
import { Icon, ICON, T, Tap } from "./ui";
import { Logo } from "./ProductArt";

export const deptHref = (name: string) => "/shop?dept=" + encodeURIComponent(name);

const DEPARTMENTS = ["Electronics", "Phones", "Home & Living", "Kitchen", "Fashion", "Beauty", "Tools & DIY", "Baby & Kids"];

export type SiteHeaderProps = { activeDept?: string; searchQuery?: string; searchMode?: "buy" | "rent" };

export function SiteHeader({ activeDept, searchQuery = "", searchMode = "buy" }: SiteHeaderProps) {
  const shop = useShop();
  const hv = headerVals(shop);
  const store = storeVals(shop);
  const [mode, setMode] = useState<"buy" | "rent">(searchMode);
  const [query, setQuery] = useState(searchQuery);
  const wishHref = hv.signedIn ? "/account?tab=wishlist" : "/signin?next=" + encodeURIComponent("/account?tab=wishlist");
  const submit = () => navigate(searchHref(query, mode));

  return (
    <View>
      {/* utility bar */}
      <View style={{ height: 34, paddingHorizontal: GUTTER, backgroundColor: C.navy, flexDirection: "row", alignItems: "center" }}>
        <View style={{ height: 24, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 8 }}>
          <Icon xml={ICON.pin} size={14} color={C.mint} sw={2} />
          <T s={12} c={C.white}>
            Deliver to{" "}
            <T s={12} w={700} c={C.white}>
              {store.city}
            </T>
          </T>
          <Icon xml={ICON.chevronDown} size={12} color={C.white} sw={2.2} />
        </View>
      </View>

      {/* header: logo + actions, then search */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 12, gap: 24 }}>
        <View style={{ height: 52, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Tap href="/" label="Simbatech home" style={{ marginRight: "auto" }}>
            <Logo height={36} />
          </Tap>
          <Tap
            onPress={openCategoryMenu}
            label="All categories"
            style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}
          >
            <Icon xml={ICON.grid} size={18} sw={1.8} />
          </Tap>
          <Tap href={hv.accountHref} label={hv.signedIn ? "My account" : "Sign in"}>
            <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: hv.signedIn ? C.navy : C.sand, alignItems: "center", justifyContent: "center" }}>
              {hv.signedIn ? (
                <T s={13} w={700} c={C.white}>
                  {hv.userInitials}
                </T>
              ) : (
                <Icon xml={ICON.user} size={20} sw={1.7} />
              )}
            </View>
          </Tap>
          {hv.signedIn ? (
            <Tap href={wishHref} label={"Wishlist, " + hv.wishCount + " saved"}>
              <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" }}>
                <Icon xml={ICON.heart} size={20} sw={1.7} />
                {hv.wishCount > 0 ? <Badge count={hv.wishCount} color={C.navy} /> : null}
              </View>
            </Tap>
          ) : null}
          <Tap href="/cart" label={"Cart, " + hv.cartCount + " items"} style={{ height: 44, paddingHorizontal: 6, borderRadius: 14, backgroundColor: C.navy, justifyContent: "center" }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.navySoft, alignItems: "center", justifyContent: "center" }}>
              <Icon xml={ICON.cart} size={20} color={C.white} sw={1.8} />
              <Badge count={hv.cartCount} color={C.green} top={-5} right={-5} />
            </View>
          </Tap>
        </View>

        <View style={{ height: 48, padding: 5, borderWidth: 1, borderColor: C.navy, borderRadius: 14, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ padding: 2, borderRadius: 12, backgroundColor: C.sky, flexDirection: "row", gap: 2 }} accessibilityLabel="Buy or rent">
            {(["buy", "rent"] as const).map((m) => {
              const on = m === mode;
              return (
                <Tap
                  key={m}
                  onPress={() => setMode(m)}
                  hitSlop={2}
                  accessibilityState={{ selected: on }}
                  style={{ height: 30, paddingHorizontal: 10, borderRadius: 9, backgroundColor: on ? C.navy : "transparent", justifyContent: "center" }}
                >
                  <T s={13} w={600} c={on ? C.white : C.navy}>
                    {m === "buy" ? "Buy" : "Rent"}
                  </T>
                </Tap>
              );
            })}
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search Simbatech"
            placeholder={mode === "rent" ? 'What do you need to rent? Try "party tent" or "camera"' : "Search phones, sofas, sneakers and more"}
            placeholderTextColor="#757575"
            style={[{ flex: 1, minWidth: 0, height: 40, paddingHorizontal: 4, paddingVertical: 0, fontFamily: F.g400, fontSize: 14, color: C.ink }, { outlineWidth: 0 } as object]}
          />
          <Tap onPress={submit} label="Search" hitSlop={4} style={{ width: 38, height: 36, borderRadius: 11, backgroundColor: C.green, alignItems: "center", justifyContent: "center" }}>
            <Icon xml={ICON.search} size={17} color={C.white} sw={2.2} />
          </Tap>
        </View>
      </View>

      {/* departments */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Departments"
        style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, flexGrow: 0 }}
        contentContainerStyle={{ height: 44, paddingHorizontal: GUTTER, alignItems: "center", gap: 22 }}
      >
        {DEPARTMENTS.map((d) => {
          const on = d === activeDept;
          return (
            <Tap key={d} href={deptHref(d)}>
              <T s={13} w={on ? 600 : 500} c={on ? C.navy : C.text}>
                {d}
              </T>
            </Tap>
          );
        })}
        <View style={{ width: 4 }} />
        <Tap href="/shop?mode=rent" style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.greenBg, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon xml={ICON.calendar} size={15} color={C.green} sw={2} />
          <T s={13} w={600} c={C.green}>
            Rent anything
          </T>
        </Tap>
        <Tap href="/shop?deals=1" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon xml={ICON.tag} size={15} color={C.red} sw={2} />
          <T s={13} w={600} c={C.red}>
            Deals
          </T>
        </Tap>
      </ScrollView>
    </View>
  );
}

function Badge({ count, color, top = -2, right = -2 }: { count: number; color: string; top?: number; right?: number }) {
  return (
    <View style={{ position: "absolute", top, right, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 999, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <T s={11} w={700} c={C.white} lh={14}>
        {count}
      </T>
    </View>
  );
}
