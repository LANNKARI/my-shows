import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, styles as s } from "./theme";
import { imageUrl } from "./api";
import { LibraryItem, progress } from "./domain";
export function Button({
  title,
  onPress,
  busy = false,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.outline,
        { opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={secondary ? colors.accent : colors.onAccent}
        />
      ) : (
        <Text style={[s.buttonText, secondary && { color: colors.text }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Poster({ url, title }: { url?: string | null; title: string }) {
  const uri = imageUrl(url);
  return uri ? (
    <Image
      source={{ uri }}
      accessibilityLabel={`Постер: ${title}`}
      style={s.poster}
    />
  ) : (
    <View
      style={[s.poster, { alignItems: "center", justifyContent: "center" }]}
    >
      <Ionicons name="film-outline" color={colors.muted} size={24} />
    </View>
  );
}
export function ProgressBar({ item }: { item: LibraryItem }) {
  const p = progress(item);
  return (
    <View style={{ gap: 8 }}>
      <View
        accessibilityLabel={`Просмотрено ${p.watched} из ${p.total}`}
        style={s.track}
      >
        <View style={[s.fill, { width: `${p.percent}%` }]} />
      </View>
      <Text style={s.muted}>
        {p.total
          ? `${p.watched} из ${p.total} ${item.kind === "movie" ? "фильма" : "серий"}`
          : "Число серий уточняется"}
      </Text>
    </View>
  );
}
export function LibraryRow({
  item,
  onOpen,
}: {
  item: LibraryItem;
  onOpen: () => void;
}) {
  const p = progress(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть ${item.title}`}
      onPress={onOpen}
      style={[s.row, s.divider]}
    >
      <Poster url={item.posterUrl} title={item.title} />
      <View style={[s.flex, { gap: 7 }]}>
        <Text style={s.heading}>{item.title}</Text>
        <Text style={s.muted}>
          {item.kind === "movie"
            ? "Фильм"
            : p.next
              ? `Сезон ${p.next.season} · серия ${p.next.episode} впереди`
              : "Сериал"}
          {item.year ? ` · ${item.year}` : ""}
        </Text>
        <ProgressBar item={item} />
      </View>
      <Ionicons name="chevron-forward" color={colors.muted} size={18} />
    </Pressable>
  );
}

export function Cover({ url, title }: { url?: string | null; title: string }) {
  const uri = imageUrl(url);
  const [failedUri, setFailedUri] = useState<string>();
  return (
    <View
      style={{
        height: 180,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#30264c",
        justifyContent: "flex-end",
      }}
    >
      <View style={{ position: "absolute", top: 28, alignSelf: "center" }}>
        <Ionicons name="film-outline" size={42} color={colors.muted} />
      </View>
      {uri && failedUri !== uri && (
        <Image
          source={{ uri }}
          resizeMode="cover"
          accessibilityLabel={`Постер: ${title}`}
          onError={() => setFailedUri(uri)}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
      )}
      <View style={{ backgroundColor: "rgba(11,12,35,0.75)", padding: 14 }}>
        <Text style={s.heading}>{title}</Text>
      </View>
    </View>
  );
}
