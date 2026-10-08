import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import BlessingDom from "./BlessingDom";
import {
  readContentHistory,
  readSceneAsset,
  writeContentHistory,
  fetchSceneAsset,
  cancelSceneAsset,
  protectSceneAssets,
  releaseSceneAssets,
  maintainSceneCache,
  resetSceneCacheSession,
} from "./scene-cache";

const SAVE_KEY = "cyber-bless:personal:v1";
export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
function Shell() {
  const [active, setActive] = useState(AppState.currentState === "active");
  const [backRequest, setBackRequest] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);
  const canGoBack = useRef(false);
  const queue = useRef(Promise.resolve());
  const readSave = useCallback(async () => {
    await queue.current.catch(() => {});
    return AsyncStorage.getItem(SAVE_KEY);
  }, []);
  const writeSave = useCallback((raw: string) => {
    const pending = queue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(SAVE_KEY, raw));
    queue.current = pending;
    return pending;
  }, []);
  const haptic = useCallback(async () => {
    await Haptics.selectionAsync().catch(() => {});
  }, []);
  const onCanGoBack = useCallback(async (value: boolean) => {
    canGoBack.current = value;
  }, []);
  useEffect(() => {
    const app = AppState.addEventListener("change", (next) =>
      setActive(next === "active"),
    );
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack.current) return false;
      setBackRequest((n) => n + 1);
      return true;
    });
    return () => {
      app.remove();
      back.remove();
    };
  }, []);
  const fail = () => {
    void resetSceneCacheSession().catch(() => {});
    canGoBack.current = false;
    setFailed(true);
  };
  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />
      <BlessingDom
        key={generation}
        readSave={readSave}
        readContentHistory={readContentHistory}
        readSceneAsset={readSceneAsset}
        writeContentHistory={writeContentHistory}
        fetchSceneAsset={fetchSceneAsset}
        cancelSceneAsset={cancelSceneAsset}
        protectSceneAssets={protectSceneAssets}
        releaseSceneAssets={releaseSceneAssets}
        maintainSceneCache={maintainSceneCache}
        catalogUrl={process.env.EXPO_PUBLIC_SCENE_CATALOG_URL ?? ""}
        manifestUrl={process.env.EXPO_PUBLIC_SCENE_MANIFEST_URL ?? ""}
        writeSave={writeSave}
        haptic={haptic}
        onCanGoBack={onCanGoBack}
        active={active}
        backRequest={backRequest}
        dom={{
          useExpoDOMWebView: false,
          onMessage: __DEV__
            ? (event) => {
                try {
                  const message = JSON.parse(event.nativeEvent.data);
                  if (message.type === "wbr:dom-bootstrap")
                    console.info("[BlessingDOM] bootstrap", message.data.status);
                } catch {
                  // Other WebView messages are handled by Expo's DOM wrapper.
                }
              }
            : undefined,
          style: styles.webview,
          contentInsetAdjustmentBehavior: "never",
          onError: fail,
          onContentProcessDidTerminate: fail,
          ...(Platform.OS === "android" ? { onRenderProcessGone: fail } : {}),
        }}
      />
      {failed && (
        <View style={styles.failure} accessibilityRole="alert">
          <Text style={styles.message}>
            画面暂时无法打开，已保存的记录仍在设备上。
          </Text>
          <Pressable
            style={styles.retry}
            onPress={() => {
              setFailed(false);
              setGeneration((n) => n + 1);
            }}
          >
            <Text style={styles.retryLabel}>重新打开</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
// Island shell colours (packages/app/src/style.css): the safe-area bands and
// the WebView's first paint are the mint page, like index.html's theme-color.
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#cdf1e6" },
  webview: { flex: 1, backgroundColor: "#cdf1e6" },
  failure: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#fbf3dc",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    gap: 24,
  },
  message: { color: "#4a2a12", textAlign: "center", lineHeight: 26 },
  retry: {
    backgroundColor: "#4fd8c9",
    borderColor: "#d4f8f2",
    borderWidth: 3,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  retryLabel: { color: "#064a43", fontWeight: "800", fontSize: 16 },
});
