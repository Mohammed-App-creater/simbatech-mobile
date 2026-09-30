import React from "react";
import { View } from "react-native";
import { Screen } from "@/components/Screen";
import { H } from "@/components/ui";

export default function Stub() {
  return (
    <Screen>
      <View style={{ padding: 16 }}>
        <H s={30}>cart</H>
      </View>
    </Screen>
  );
}
