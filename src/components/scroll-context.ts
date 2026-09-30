import { createContext, useContext } from "react";

export const ScrollCtx = createContext<{ toTop: () => void; scrollTo: (y: number) => void }>({ toTop: () => {}, scrollTo: () => {} });

/** Lets content inside a <Screen> scroll the page (footer "back to top", "jump to reviews", …). */
export const useScreenScroll = () => useContext(ScrollCtx);
