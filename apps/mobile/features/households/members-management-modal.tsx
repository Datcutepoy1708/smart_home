import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { color, radius, spacing } from "../../shared/theme";
import { formatVnDateTime } from "../../shared/date-utils";
import type { Session } from "../../core/session";
import {
  createInviteCode,
  fetchHouseholdMembers,
  type HouseholdMemberItem,
  type HouseholdRole,
  type InviteCodeData,
  removeMember,
  updateMemberRole,
} from "./household-data";

interface Props {
  visible: boolean;
  onClose: () => void;
  session: Session;
  householdId: string;
  householdName?: string;
  isOwner?: boolean;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function MembersManagementModal({
  visible,
  onClose,
  session,
  householdId,
  householdName = "Ngôi nhà",
  isOwner = true,
}: Props) {
  const [members, setMembers] = useState<HouseholdMemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Invite state
  const [inviteRole, setInviteRole] = useState<HouseholdRole>("MEMBER");
  const [guestHours, setGuestHours] = useState<number>(24);
  const [inviteResult, setInviteResult] = useState<InviteCodeData | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    if (!visible || !householdId) return;
    void loadMembers();
    setInviteResult(null);
  }, [visible, householdId]);

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await fetchHouseholdMembers(session, householdId);
      setMembers(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvite() {
    setCreatingInvite(true);
    try {
      const res = await createInviteCode(
        session,
        householdId,
        inviteRole,
        inviteRole === "GUEST" ? guestHours : 24,
      );
      setInviteResult(res);
      setCopiedNotice(false);
    } catch (e: unknown) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể tạo mã mời.");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleToggleRole(member: HouseholdMemberItem) {
    const nextRole: HouseholdRole = member.role === "MEMBER" ? "GUEST" : "MEMBER";
    setActionLoadingId(member.id);
    try {
      await updateMemberRole(session, householdId, member.id, nextRole);
      await loadMembers();
    } catch (e: unknown) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể đổi vai trò.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleExtendGuest(member: HouseholdMemberItem) {
    const nextExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    setActionLoadingId(member.id);
    try {
      await updateMemberRole(session, householdId, member.id, "GUEST", nextExpiry);
      await loadMembers();
    } catch (e: unknown) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể gia hạn.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRemove(member: HouseholdMemberItem) {
    const title = member.isCurrent ? "Rời khỏi nhà?" : "Xóa thành viên?";
    const msg = member.isCurrent
      ? "Bạn có chắc chắn muốn rời khỏi ngôi nhà này không?"
      : `Bạn có chắc chắn muốn xóa ${member.name} khỏi ngôi nhà?`;

    Alert.alert(title, msg, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xác nhận",
        style: "destructive",
        onPress: async () => {
          setActionLoadingId(member.id);
          try {
            await removeMember(session, householdId, member.id);
            if (member.isCurrent) {
              onClose();
            } else {
              await loadMembers();
            }
          } catch (e: unknown) {
            Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể xóa.");
          } finally {
            setActionLoadingId(null);
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIcon}>
                <Ionicons name="people" size={18} color="#fff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Thành Viên & Chia Sẻ Nhà</Text>
                <Text style={styles.headerSub}>{householdName}</Text>
              </View>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={24} color={color.textTertiary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Invite Section (Owner only) */}
            {isOwner && (
              <View style={styles.inviteCard}>
                <View style={styles.inviteHeader}>
                  <View style={styles.inviteIconCircle}>
                    <Ionicons name="person-add" size={16} color={color.primary} />
                  </View>
                  <Text style={styles.inviteTitle}>MỜI THÀNH VIÊN VÀO NHÀ</Text>
                </View>

                {/* Role select chips */}
                <Text style={styles.fieldLabel}>Chọn vai trò:</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[
                      styles.roleChip,
                      inviteRole === "MEMBER" && styles.roleChipActive,
                    ]}
                    onPress={() => setInviteRole("MEMBER")}
                  >
                    <Ionicons
                      name="person"
                      size={14}
                      color={inviteRole === "MEMBER" ? "#fff" : color.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        inviteRole === "MEMBER" && styles.roleChipTextActive,
                      ]}
                    >
                      Thành viên gia đình
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.roleChip,
                      inviteRole === "GUEST" && styles.roleChipActive,
                    ]}
                    onPress={() => setInviteRole("GUEST")}
                  >
                    <Ionicons
                      name="time"
                      size={14}
                      color={inviteRole === "GUEST" ? "#fff" : color.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        inviteRole === "GUEST" && styles.roleChipTextActive,
                      ]}
                    >
                      Khách (Tạm thời)
                    </Text>
                  </Pressable>
                </View>

                {/* Duration select for Guest */}
                {inviteRole === "GUEST" && (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: 8 }]}>
                      Thời hạn quyền cho khách:
                    </Text>
                    <View style={styles.chipRow}>
                      {[
                        { label: "24 Giờ", hours: 24 },
                        { label: "3 Ngày", hours: 72 },
                        { label: "7 Ngày", hours: 168 },
                      ].map((d) => (
                        <Pressable
                          key={d.hours}
                          style={[
                            styles.durChip,
                            guestHours === d.hours && styles.durChipActive,
                          ]}
                          onPress={() => setGuestHours(d.hours)}
                        >
                          <Text
                            style={[
                              styles.durChipText,
                              guestHours === d.hours && styles.durChipTextActive,
                            ]}
                          >
                            {d.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                {/* Generate Button */}
                <Pressable
                  style={styles.genBtn}
                  onPress={handleCreateInvite}
                  disabled={creatingInvite}
                >
                  {creatingInvite ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="ticket-outline" size={16} color="#fff" />
                      <Text style={styles.genBtnText}>Tạo Mã Mời Nhanh</Text>
                    </>
                  )}
                </Pressable>

                {/* Result Code Box */}
                {inviteResult && (
                  <View style={styles.codeBox}>
                    <Text style={styles.codeLabel}>
                      MÃ MỜI 6 KÝ TỰ • HẠN DÙNG: {formatVnDateTime(inviteResult.expiresAt)}
                    </Text>
                    <Text style={styles.codeText}>{inviteResult.code}</Text>
                    <Pressable
                      style={styles.copyBtn}
                      onPress={() => setCopiedNotice(true)}
                    >
                      <Ionicons
                        name={copiedNotice ? "checkmark-circle" : "copy-outline"}
                        size={16}
                        color={copiedNotice ? "#16a34a" : color.primary}
                      />
                      <Text
                        style={[
                          styles.copyBtnText,
                          copiedNotice && { color: "#16a34a" },
                        ]}
                      >
                        {copiedNotice ? "Đã sao chép mã!" : "Sao chép mã chia sẻ"}
                      </Text>
                    </Pressable>
                    <Text style={styles.codeHint}>
                      Người thân chỉ cần mở app Smart Home, chọn "Gia nhập nhà" và
                      nhập mã trên là được kết nối ngay!
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Member List */}
            <Text style={styles.sectionHeader}>
              DANH SÁCH THÀNH VIÊN ({members.length})
            </Text>

            {loading && !members.length ? (
              <View style={styles.loadingArea}>
                <ActivityIndicator size="large" color={color.primary} />
                <Text style={styles.loadingText}>Đang tải danh sách thành viên...</Text>
              </View>
            ) : null}

            {members.map((m) => {
              const isMemOwner = m.role === "OWNER";
              const isGuest = m.role === "GUEST";
              const isActionLoading = actionLoadingId === m.id;

              return (
                <View key={m.id} style={styles.memberCard}>
                  <View style={styles.memberTopRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(m.name)}</Text>
                    </View>

                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.name}
                        </Text>
                        {m.isCurrent && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>Bạn</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberEmail}>{m.email}</Text>
                    </View>

                    {/* Role Badge */}
                    <View
                      style={[
                        styles.roleBadge,
                        isMemOwner
                          ? styles.badgeOwner
                          : isGuest
                          ? styles.badgeGuest
                          : styles.badgeMember,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          isMemOwner
                            ? styles.badgeTextOwner
                            : isGuest
                            ? styles.badgeTextGuest
                            : styles.badgeTextMember,
                        ]}
                      >
                        {isMemOwner
                          ? "Chủ nhà 👑"
                          : isGuest
                          ? "Khách ⏳"
                          : "Thành viên 👤"}
                      </Text>
                    </View>
                  </View>

                  {/* Expiration Note for Guests */}
                  {isGuest && m.expiresAt && (
                    <View style={styles.expiryRow}>
                      <Ionicons
                        name={m.isExpired ? "alert-circle" : "time-outline"}
                        size={14}
                        color={m.isExpired ? color.error : color.textSecondary}
                      />
                      <Text
                        style={[
                          styles.expiryText,
                          m.isExpired && { color: color.error, fontWeight: "700" },
                        ]}
                      >
                        {m.isExpired
                          ? "Quyền truy cập đã hết hạn"
                          : `Hạn quyền: ${formatVnDateTime(m.expiresAt)}`}
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  {isOwner && !isMemOwner && !m.isCurrent && (
                    <View style={styles.actionRow}>
                      {isActionLoading ? (
                        <ActivityIndicator size="small" color={color.primary} />
                      ) : (
                        <>
                          <Pressable
                            style={styles.actionBtnOutline}
                            onPress={() => handleToggleRole(m)}
                          >
                            <Text style={styles.actionBtnOutlineText}>
                              {isGuest ? "Chuyển thành Thành viên" : "Chuyển thành Khách"}
                            </Text>
                          </Pressable>

                          {isGuest && (
                            <Pressable
                              style={styles.actionBtnOutline}
                              onPress={() => handleExtendGuest(m)}
                            >
                              <Text style={styles.actionBtnOutlineText}>+7 Ngày</Text>
                            </Pressable>
                          )}

                          <Pressable
                            style={styles.actionBtnDanger}
                            onPress={() => handleRemove(m)}
                          >
                            <Ionicons name="trash-outline" size={14} color={color.error} />
                            <Text style={styles.actionBtnDangerText}>Xóa</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  )}

                  {/* Leave button for non-owner current user */}
                  {!isMemOwner && m.isCurrent && (
                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.actionBtnDanger}
                        onPress={() => handleRemove(m)}
                      >
                        <Ionicons name="exit-outline" size={14} color={color.error} />
                        <Text style={styles.actionBtnDangerText}>Rời khỏi nhà này</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: color.textTertiary,
  },
  body: {
    padding: spacing.md,
  },
  inviteCard: {
    backgroundColor: "#eff6ff",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: spacing.md,
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.xs,
  },
  inviteIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: color.primary,
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: color.textSecondary,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  roleChipActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
  },
  roleChipTextActive: {
    color: "#fff",
  },
  durChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  durChipActive: {
    backgroundColor: color.primaryLight,
    borderColor: color.primary,
  },
  durChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: color.textSecondary,
  },
  durChipTextActive: {
    color: color.primary,
  },
  genBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: color.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    marginTop: spacing.sm,
  },
  genBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  codeBox: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: color.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 28,
    fontWeight: "800",
    color: color.primary,
    letterSpacing: 3,
    marginVertical: 4,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: color.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginVertical: 6,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: color.primary,
  },
  codeHint: {
    fontSize: 11,
    color: color.textTertiary,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: color.textTertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  loadingArea: {
    alignItems: "center",
    paddingVertical: 30,
    gap: spacing.xs,
  },
  loadingText: {
    fontSize: 12,
    color: color.textSecondary,
  },
  memberCard: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: spacing.sm,
  },
  memberTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: color.textPrimary,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: color.textPrimary,
  },
  currentBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: color.primary,
  },
  memberEmail: {
    fontSize: 12,
    color: color.textSecondary,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeOwner: {
    backgroundColor: "#fef3c7",
  },
  badgeMember: {
    backgroundColor: "#eff6ff",
  },
  badgeGuest: {
    backgroundColor: "#f3e8ff",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextOwner: {
    color: "#b45309",
  },
  badgeTextMember: {
    color: color.primary,
  },
  badgeTextGuest: {
    color: "#7e22ce",
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: color.surfaceVariant,
  },
  expiryText: {
    fontSize: 11,
    color: color.textSecondary,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: color.surfaceVariant,
  },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: color.background,
  },
  actionBtnOutlineText: {
    fontSize: 11,
    fontWeight: "600",
    color: color.textSecondary,
  },
  actionBtnDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  actionBtnDangerText: {
    fontSize: 11,
    fontWeight: "700",
    color: color.error,
  },
});
