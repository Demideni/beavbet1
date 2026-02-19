--- a/app/components/PromoTiles.tsx
+++ b/app/components/PromoTiles.tsx
@@ -20,33 +20,43 @@
       href={href}
       className="group tile-hover relative overflow-hidden rounded-3xl card-glass p-5 lg:p-7 min-h-[150px] transition min-w-[260px] md:min-w-0 snap-start"
     >
-      {/* Mobile-only banner background */}
-      {mobileBg ? (
-        <div
-          className="absolute inset-0 bg-cover bg-center md:hidden"
-          style={{ backgroundImage: `url(${mobileBg})` }}
+      {/* Background image (mobile/desktop) */}
+      <div className="absolute inset-0">
+        {/* Desktop */}
+        <Image
+          src={desktopArt}
+          alt={title}
+          fill
+          priority={false}
+          className="hidden md:block object-cover"
+          sizes="(min-width: 768px) 50vw, 0px"
         />
-      ) : null}
+        {/* Mobile */}
+        <Image
+          src={mobileBg ?? desktopArt}
+          alt={title}
+          fill
+          priority={false}
+          className="md:hidden object-cover"
+          sizes="(max-width: 768px) 100vw, 0px"
+        />
+      </div>
 
-      {/* Subtle dark overlay for text readability on mobile */}
-      {mobileBg ? <div className="absolute inset-0 bg-black/25 md:hidden" /> : null}
+      {/* Subtle dark overlay for text readability */}
+      <div className="absolute inset-0 bg-black/25" />
 
       <div className="relative z-10">
         <div className="flex items-center gap-2">
           <div className="text-2xl font-extrabold">{title}</div>
           <ChevronRight className="size-5 text-white/55 group-hover:text-white/80 transition" />
         </div>
+
         {/* Keep description on desktop only (mobile: hide) */}
         {desc ? (
           <div className="mt-2 text-white/60 max-w-[420px] hidden md:block">
             {desc}
           </div>
         ) : null}
-      </div>
-
-      {/* Desktop art (mobile uses banner) */}
-      <div className="absolute right-4 bottom-2 w-[160px] h-[160px] opacity-90 group-hover:opacity-100 transition hidden md:block">
-        <Image src={desktopArt} alt={title} fill className="object-contain" />
       </div>
 
       <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/0 to-white/5" />
