/*
 * The "All categories" menu, opened by the grid button in the header: a full-screen sheet with the
 * departments as a swipeable row, the chosen department's groups and links, and its promo tile.
 * Every link opens the shop filtered to that department (same behaviour as the site's mega menu).
 */
import React, { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, GUTTER } from "@/theme";
import { DEPTS } from "@/lib/menu";
import { navigate } from "@/lib/store";
import { closeCategoryMenu, useCategoryMenuOpen } from "@/lib/ui-state";
import { H, Icon, ICON, T, Tap } from "./ui";
import { ProductArt } from "./ProductArt";
import { deptHref } from "./SiteHeader";

export function CategoryMenu() {
  const open = useCategoryMenuOpen();
  const insets = useSafeAreaInsets();
  const [deptIdx, setDeptIdx] = useState(0);
  const dept = DEPTS[deptIdx];
  const href = deptHref(dept.shop);
  const go = () => {
    closeCategoryMenu();
    navigate(href);
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={closeCategoryMenu} statusBarTranslucent accessibilityLabel="All categories">
      <View style={{ flex: 1, backgroundColor: C.white }}>
        {/* departments */}
        <View style={{ backgroundColor: "#F6F8FB", paddingTop: insets.top }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingVertical: 12, gap: 2 }}>
            {DEPTS.map((d, i) => {
              const on = i === deptIdx;
              return (
                <Tap
                  key={d.name}
                  onPress={() => setDeptIdx(i)}
                  hitSlop={0}
                  accessibilityState={{ selected: on }}
                  style={[
                    { height: 40, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: on ? C.white : "transparent" },
                    on && { boxShadow: "0 2px 8px rgba(13,79,139,0.12)" },
                  ]}
                >
                  <T s={15} w={600} c={on ? C.navy : C.ink}>
                    {d.name}
                  </T>
                  <Icon xml={ICON.chevronRight} size={14} color={on ? C.navy : C.ink} />
                </Tap>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 32 + insets.bottom, gap: 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 16, flexShrink: 1 }}>
              <H s={30} lh={36} style={{ flexShrink: 1 }}>
                {dept.name}
              </H>
              <Tap onPress={go}>
                <T s={14} w={600} c={C.blue}>
                  Shop all
                </T>
              </Tap>
            </View>
            <Tap onPress={closeCategoryMenu} label="Close menu" style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" }}>
              <Icon xml={ICON.close} size={16} sw={2.2} />
            </Tap>
          </View>

          <View style={{ gap: 28 }}>
            {dept.groups.map((grp) => (
              <View key={grp.title} style={{ gap: 12 }}>
                <T s={12} w={700} c={C.muted} ls={1.2} upper>
                  {grp.title}
                </T>
                {grp.links.map((l) => (
                  <Tap key={l.label} onPress={go} style={{ alignSelf: "flex-start" }}>
                    <T s={15} w={500}>
                      {l.label}
                    </T>
                  </Tap>
                ))}
              </View>
            ))}
          </View>

          {/* promo tile */}
          <Tap onPress={go} style={{ borderRadius: 20, backgroundColor: dept.promoBg, padding: 24, paddingRight: 12, flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
            <View style={{ flex: 1, gap: 6 }}>
              <T s={12} w={700} c={dept.promoFg} ls={0.96} upper>
                {dept.promoEyebrow}
              </T>
              <H s={24} lh={25}>
                {dept.promoTitle}
              </H>
            </View>
            <ProductArt kind={dept.kind} size={116} />
          </Tap>
        </ScrollView>
      </View>
    </Modal>
  );
}
