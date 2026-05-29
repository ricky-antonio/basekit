"use client"

import { useRef, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PageHeader from "@/components/shared/PageHeader"
import { updateProfileAction, uploadAvatarAction } from "@/app/(app)/settings/actions"
import toast from "react-hot-toast"
import { IconUser } from "@tabler/icons-react"

interface ProfileFormProps {
  displayName: string
  avatarUrl: string | null
  email: string
}

export default function ProfileForm({ displayName, avatarUrl, email }: ProfileFormProps) {
  const [name, setName] = useState(displayName)
  const [avatar, setAvatar] = useState(avatarUrl)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingProfile(true)
    const fd = new FormData(e.currentTarget)
    const result = await updateProfileAction(fd)
    setSavingProfile(false)
    if (result.ok) {
      toast.success("Profile updated.")
    } else {
      toast.error(result.error.error)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const fd = new FormData()
    fd.set("avatar", file)
    const result = await uploadAvatarAction(fd)
    setUploadingAvatar(false)
    if (result.ok) {
      setAvatar(result.data)
      toast.success("Avatar updated.")
    } else {
      toast.error(result.error.error)
    }
    // Reset so the same file can be re-selected
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Manage your personal details." />

      {/* Avatar */}
      <section
        className="rounded-xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Avatar
        </h2>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback
              className="text-lg font-semibold"
              style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}
            >
              {initials || <IconUser size={24} />}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => fileRef.current?.click()}
            >
              {uploadingAvatar ? "Uploading…" : "Change avatar"}
            </Button>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              JPEG, PNG, or WebP — max 2 MB
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-label="Upload avatar"
              onChange={handleAvatarChange}
            />
          </div>
        </div>
      </section>

      {/* Display name */}
      <section
        className="rounded-xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Personal info
        </h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              name="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} disabled />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Email is managed by your auth provider.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
