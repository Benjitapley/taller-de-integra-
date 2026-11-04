"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Impide envíos HTML accidentales antes de hidratar o si JavaScript está desactivado. */
export function useFormReady() {
  return useSyncExternalStore(subscribe, clientReady, serverReady);
}
