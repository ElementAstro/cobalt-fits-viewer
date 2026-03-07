import { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, Alert } from "react-native";
import { Button, Card, Input, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSessionStore } from "../../stores/observation/useSessionStore";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useI18n } from "../../i18n/useI18n";
import { useSessions } from "../../hooks/sessions/useSessions";
import { LiveSessionMetaSheet } from "./LiveSessionMetaSheet";

export function ActiveSessionBanner() {
  const { t } = useI18n();
  const [mutedColor, dangerColor] = useThemeColor(["muted", "danger"]);

  const activeSession = useSessionStore((s) => s.activeSession);
  const startLiveSession = useSessionStore((s) => s.startLiveSession);
  const pauseLiveSession = useSessionStore((s) => s.pauseLiveSession);
  const resumeLiveSession = useSessionStore((s) => s.resumeLiveSession);
  const addActiveNote = useSessionStore((s) => s.addActiveNote);
  const { endLiveSessionWithIntegration } = useSessions();

  const [elapsed, setElapsed] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showMetaSheet, setShowMetaSheet] = useState(false);

  const files = useFitsStore((s) => s.files);
  const linkedFileCount = useMemo(
    () => files.filter((f) => f.sessionId === activeSession?.id).length,
    [files, activeSession?.id],
  );

  const sessionStatus = activeSession?.status;
  const sessionStartedAt = activeSession?.startedAt;
  const sessionTotalPausedMs = activeSession?.totalPausedMs;

  useEffect(() => {
    if (sessionStatus !== "running" || !sessionStartedAt) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - sessionStartedAt - (sessionTotalPausedMs ?? 0)) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStatus, sessionStartedAt, sessionTotalPausedMs]);

  useEffect(() => {
    if (activeSession?.status === "paused" && activeSession.pausedAt) {
      const totalPaused = activeSession.totalPausedMs + (Date.now() - activeSession.pausedAt);
      setElapsed(Math.floor((Date.now() - activeSession.startedAt - totalPaused) / 1000));
    }
  }, [
    activeSession?.status,
    activeSession?.pausedAt,
    activeSession?.startedAt,
    activeSession?.totalPausedMs,
  ]);

  useEffect(() => {
    if (!activeSession) {
      setShowMetaSheet(false);
    }
  }, [activeSession]);

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleEnd = useCallback(() => {
    Alert.alert(t("sessions.endSession"), t("sessions.endSessionConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: () => {
          const { session, linkedFileCount, linkedLogCount } = endLiveSessionWithIntegration();
          if (session) {
            Alert.alert(
              t("common.success"),
              `${t("sessions.sessionSaved")} (${linkedFileCount} ${t("sessions.frames")}, ${linkedLogCount} ${t("sessions.log")})`,
            );
          }
        },
      },
    ]);
  }, [endLiveSessionWithIntegration, t]);

  const handleAddNote = useCallback(() => {
    if (!noteText.trim()) return;
    addActiveNote(noteText.trim());
    setNoteText("");
  }, [noteText, addActiveNote]);

  if (!activeSession) {
    return (
      <View className="mx-4 mb-3">
        <Button variant="outline" onPress={startLiveSession} className="w-full">
          <Ionicons name="play-circle-outline" size={16} color={mutedColor} />
          <Button.Label>{t("sessions.startSession")}</Button.Label>
        </Button>
      </View>
    );
  }

  return (
    <>
      <Card variant="secondary" className="mx-4 mb-3 border border-primary/30">
        <Card.Body className="gap-2 p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                className={`h-2.5 w-2.5 rounded-full ${activeSession.status === "running" ? "bg-success" : "bg-warning"}`}
              />
              <Text className="text-sm font-bold text-foreground">
                {activeSession.status === "running"
                  ? t("sessions.observing")
                  : t("sessions.paused")}
              </Text>
            </View>
            <Text className="font-mono text-lg font-bold text-primary">
              {formatElapsed(elapsed)}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            {activeSession.status === "running" ? (
              <Button size="sm" variant="outline" onPress={pauseLiveSession} className="flex-1">
                <Ionicons name="pause" size={14} color={mutedColor} />
                <Button.Label>{t("sessions.pause")}</Button.Label>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onPress={resumeLiveSession} className="flex-1">
                <Ionicons name="play" size={14} color={mutedColor} />
                <Button.Label>{t("sessions.resume")}</Button.Label>
              </Button>
            )}
            <Button size="sm" variant="outline" onPress={handleEnd} className="flex-1">
              <Ionicons name="stop" size={14} color={dangerColor} />
              <Button.Label className="text-red-500">{t("sessions.endSession")}</Button.Label>
            </Button>
          </View>

          <View className="flex-row items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={() => setShowMetaSheet(true)}
              className="flex-1"
            >
              <Ionicons name="create-outline" size={14} color={mutedColor} />
              <Button.Label>{t("sessions.liveMeta")}</Button.Label>
            </Button>
          </View>

          <View className="flex-row items-center gap-2">
            <TextField className="flex-1">
              <Input
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t("sessions.addNote")}
                className="text-xs"
                onSubmitEditing={handleAddNote}
              />
            </TextField>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              onPress={handleAddNote}
              isDisabled={!noteText.trim()}
            >
              <Ionicons name="send" size={14} color={mutedColor} />
            </Button>
          </View>

          {linkedFileCount > 0 && (
            <View className="flex-row items-center gap-1 mt-1">
              <Ionicons name="images-outline" size={11} color={mutedColor} />
              <Text className="text-[10px] text-muted">
                {linkedFileCount} {t("sessions.filesLinked")}
              </Text>
            </View>
          )}

          {activeSession.notes.length > 0 && (
            <View className="mt-1 gap-0.5">
              {(showAllNotes ? activeSession.notes : activeSession.notes.slice(-3)).map((n) => (
                <Text key={n.timestamp} className="text-[9px] text-muted" numberOfLines={1}>
                  [
                  {new Date(n.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  ] {n.text}
                </Text>
              ))}
              {activeSession.notes.length > 3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => setShowAllNotes((v) => !v)}
                  className="self-start mt-0.5"
                >
                  <Button.Label className="text-[9px]">
                    {showAllNotes
                      ? t("common.collapse")
                      : `${t("common.showAll")} (${activeSession.notes.length})`}
                  </Button.Label>
                </Button>
              )}
            </View>
          )}
        </Card.Body>
      </Card>
      <LiveSessionMetaSheet visible={showMetaSheet} onClose={() => setShowMetaSheet(false)} />
    </>
  );
}
