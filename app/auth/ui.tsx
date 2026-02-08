"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/components/utils/cn";
import type React from "react";
import { useMemo, useState } from "react";

function Field({
  type,
  placeholder,
  right,
  value,
  onChange,
}: {
  type: string;
  placeholder: string;
  right?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full px-4 py-4 rounded-2xl",
          "bg-white/5 border border-white/10",
          "outline-none focus:border-white/20 focus:bg-white/7",
          "text-sm text-white/85 placeholder:text-white/35",
          right ? "pr-12" : ""
        )}
      />
      {right ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>
      ) : null}
    </div>
  );
}

export default function AuthClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const tab = sp.get("tab") === "login" ? "login" : "register";
  // Safety: only allow in-app relative redirects.
  const rawNext = sp.get("next") || "/account";
  const next = rawNext.startsWith("/") ? rawNext : "/account";
  const isRegister = tab === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [promo, setPromo] = useState("");
  const [agree, setAgree] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!email || password.length < 6) return false;
    if (isRegister && !agree) return false;
    return true;
  }, [email, password, isRegister, agree]);

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Top promo banner (mobile reference-like) */}
      <section className="rounded-3xl overflow-hidden card-glass gradient-hero">
        <div className="relative min-h-[180px]">
          <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/60 via-transparent to-transparent" />

          <div className="relative z-10 p-6 flex items-start justify-between gap-4">
            <div>
              <div className="text-white font-extrabold tracking-tight text-3xl leading-tight">
                ПРИВЕТСТВЕННЫЙ
                <br />
                БОНУС
                <br />
                ДО 590%
              </div>
              <div className="mt-3 text-white/65 text-lg">+225 Фри Спинов</div>
            </div>

            <div className="relative w-28 h-28 shrink-0">
              <Image
                src="/banners/hero-1.png"
                alt="Подарок"
                fill
                className="object-cover rounded-2xl opacity-90"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-2">
        <Link
          href={`/auth?tab=login${next ? `&next=${encodeURIComponent(next)}` : ""}`}
          className={cn(
            "text-center py-3 text-lg font-semibold",
            tab === "login" ? "text-white" : "text-white/55"
          )}
        >
          Войти
        </Link>
        <Link
          href={`/auth?tab=register${next ? `&next=${encodeURIComponent(next)}` : ""}`}
          className={cn(
            "text-center py-3 text-lg font-semibold",
            tab === "register" ? "text-white" : "text-white/55"
          )}
        >
          Регистрация
        </Link>
      </div>
      <div className="h-px bg-white/10" />

      {/* Form */}
      <section className="mt-5 rounded-3xl card-glass p-5">
        <div className="flex flex-col gap-4">
          <Field
            type="email"
            placeholder="Введите адрес электронной почты"
            value={email}
            onChange={setEmail}
          />
          <Field
            type="password"
            placeholder="Введите ваш пароль"
            value={password}
            onChange={setPassword}
          />
          {isRegister ? (
            <Field
              type="text"
              placeholder="Введите промокод (необязательно)"
              value={promo}
              onChange={setPromo}
            />
          ) : null}

          {isRegister ? (
            <label className="flex items-start gap-3 mt-2">
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span className="text-white/55 text-sm">
                Я подтверждаю, что мне 18 лет и я прочитал(а) {" "}
                <span className="underline text-white/70">Условия предоставления услуг</span>
              </span>
            </label>
          ) : null}

          {error ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-sm text-white/80">
              {error}
            </div>
          ) : null}

          <button
            disabled={!canSubmit || busy}
            className="mt-2 w-full px-6 py-4 rounded-2xl btn-accent font-semibold disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
                const body = isRegister
                  ? { email, password, promo: promo || undefined }
                  : { email, password };
                const r = await fetch(endpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify(body),
                });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) {
                  if (j?.error === "EMAIL_TAKEN") setError("Этот email уже зарегистрирован");
                  else if (j?.error === "INVALID_CREDENTIALS") setError("Неверный email или пароль");
                  else setError("Не удалось выполнить операцию");
                  return;
                }

                // Use a hard navigation to guarantee the new httpOnly cookie is attached
                // to the next request (Safari/dev can be finicky with client transitions).
                window.location.assign(next);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Подождите…" : isRegister ? "Создать аккаунт" : "Войти"}
          </button>
        </div>
      </section>

      {/* Tiny helper link (in case user wants to jump manually) */}
      <div className="mt-4 text-center text-sm text-white/55">
        Уже вошли?{" "}
        <a className="underline text-white/80" href={next}>
          Перейти в кабинет
        </a>
      </div>
    </div>
  );
}
