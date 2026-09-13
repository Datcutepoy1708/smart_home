import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useDevices } from "./use-devices";
import { styles as s } from "../../shared/components/screen-styles";
export default function DevicesScreen() {
  const { home, items, loading, error, refresh, more } = useDevices();
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} />
      }
    >
      <Text style={s.title}>{home?.name ?? "Your home"}</Text>
      <View style={s.row}>
        <Text style={s.subtitle}>Devices</Text>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          style={s.secondary}
          onPress={refresh}
        >
          <Text style={s.link}>Refresh</Text>
        </Pressable>
      </View>
      {error ? (
        <View style={s.group}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          {items.length > 0 && (
            <Text style={s.subtitle}>Showing previously loaded readings.</Text>
          )}
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={refresh}
          >
            <Text style={s.buttonText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {loading && !items.length ? (
        <ActivityIndicator
          accessibilityLabel="Loading devices"
          color="#17634B"
        />
      ) : null}
      {!loading && !error && !items.length ? (
        <Text style={s.subtitle}>
          {home ? "No devices in this home yet." : "No accessible home."}
        </Text>
      ) : null}
      {items.map((device) => (
        <View key={device.id} style={s.device}>
          <View style={s.row}>
            <Text style={[s.label, { fontSize: 18, flexShrink: 1 }]}>
              {device.name}
            </Text>
            <Text
              style={{
                color: device.isOnline && !error ? "#17634B" : "#765D19",
              }}
            >
              {error
                ? "Status unavailable"
                : device.isOnline
                  ? "Online"
                  : "Offline"}
            </Text>
          </View>
          {device.room ? <Text style={s.subtitle}>{device.room}</Text> : null}
          <View style={s.row}>
            {["temperature", "humidity"].map((metric) => {
              const reading = device.readings.find((r) => r.metric === metric);
              return (
                <View key={metric} style={s.group}>
                  <Text style={s.label}>
                    {metric === "temperature" ? "Temperature" : "Humidity"}
                  </Text>
                  <Text style={s.reading}>
                    {reading ? `${reading.value} ${reading.unit}` : "--"}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={s.subtitle}>
            {device.lastSeenAt
              ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}`
              : "No readings received yet"}
          </Text>
        </View>
      ))}
      {more ? (
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={more}
          style={s.secondary}
        >
          <Text style={s.link}>Load more</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
