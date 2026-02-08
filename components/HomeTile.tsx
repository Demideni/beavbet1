"use client"

type Props = {
  title: string
  href: string
  mobileImage: string
  description?: string
}

export default function HomeTile({ title, href, mobileImage, description }: Props) {
  return (
    <a
      href={href}
      className="
        relative rounded-2xl overflow-hidden
        min-h-[150px] p-4
        flex flex-col justify-end
        text-white font-semibold text-lg
      "
    >
      {/* mobile banner */}
      <div
        className="absolute inset-0 bg-cover bg-center md:hidden"
        style={{ backgroundImage: `url(${mobileImage})` }}
      />

      {/* desktop background */}
      <div className="absolute inset-0 hidden md:block bg-gradient-to-br from-[#1b2a44] to-[#0b1220]" />

      {/* overlay */}
      <div className="absolute inset-0 bg-black/25" />

      <div className="relative z-10">
        <div className="flex items-center gap-2">
          {title} <span>›</span>
        </div>

        {description && (
          <p className="hidden md:block text-sm opacity-70 font-normal mt-1">
            {description}
          </p>
        )}
      </div>
    </a>
  )
}
