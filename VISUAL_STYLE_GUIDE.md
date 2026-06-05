# 🎨 SSB Form 16 Portal - Visual Style Guide

## Brand Colors

### Primary Palette
```
🔵 Primary Blue:        #3B82F6 (Blue 500)
🟦 Primary Indigo:      #4F46E5 (Indigo 600)
🟪 Secondary Purple:    #9333EA (Purple 600)
🟢 Accent Green:        #22C55E (Green 500)
🔴 Accent Red:          #EF4444 (Red 500)
```

### Gradients
```
1. Blue → Indigo
   from-blue-500 to-indigo-600
   
2. Indigo → Purple
   from-indigo-500 to-purple-600
   
3. Blue → Indigo → Purple
   from-blue-500 via-indigo-500 to-purple-600
   
4. Success Green
   from-green-500 to-green-600
   
5. Alert Red
   from-red-500 to-red-600
```

### Dark Mode Palette
```
🌑 Background Dark:     #111827 (Gray 900)
🌑 Card Background:     #1F2937 (Gray 800)
🌑 Border Dark:         #374151 (Gray 700)
✨ Text Light:          #F3F4F6 (Gray 100)
💡 Text Muted:          #D1D5DB (Gray 300)
```

---

## Typography

### Font Stack
```
Font Family: 
  System: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto
  Fallback: sans-serif
```

### Font Sizes
```
H1 (Headings):        text-4xl md:text-5xl    (36px / 48px)
H2 (Subheading):      text-2xl md:text-3xl    (24px / 30px)
H3 (Card Title):      text-lg md:text-xl      (18px / 20px)
Body (Normal):        text-base               (16px)
Label (Small):        text-sm                 (14px)
Caption (Tiny):       text-xs                 (12px)
```

### Font Weights
```
Light:       100-300
Normal:      400
Medium:      500
Bold:        700 (font-bold)
Extra Bold:  900 (font-black) - For headings
```

### Letter Spacing
```
Normal:     tracking-normal
Wide:       tracking-widest (for labels)
Extra:      tracking-[0.2em] (for emphasis)
```

---

## Spacing System

### Responsive Padding Scale
```
Mobile:      p-3   = 12px
Tablet:      p-4   = 16px
Desktop:     p-6   = 24px
Large:       p-8   = 32px
XLarge:      p-12  = 48px
```

### Margin Scale
```
Compact:     m-2   = 8px
Default:     m-4   = 16px
Large:       m-6   = 24px
XLarge:      m-8   = 32px
```

### Gap (Grid/Flex)
```
Tight:       gap-2 = 8px
Compact:     gap-4 = 16px
Default:     gap-6 = 24px
Large:       gap-8 = 32px
```

---

## Border Radius

### Radius Sizes
```
Small:       rounded-lg    = 8px
Medium:      rounded-xl    = 12px
Large:       rounded-2xl   = 16px
Extra Large: rounded-3xl   = 24px
Full:        rounded-full  = 50%
```

### Usage
```
Buttons:           rounded-xl (12px)
Cards:             rounded-2xl (16px)
Hero Sections:     rounded-3xl (24px)
Badges:            rounded-full
Input Fields:      rounded-xl (12px)
```

---

## Shadow System

### Shadow Levels
```
Subtle:     shadow-sm
Default:    shadow
Elevated:   shadow-md
High:       shadow-lg
Very High:  shadow-xl
Extra High: shadow-2xl
```

### Usage
```
Cards:           shadow-lg (default)
On Hover:        shadow-xl / shadow-2xl
Modals:          shadow-2xl
Buttons:         shadow (default)
```

---

## Animations & Transitions

### Duration Scale
```
Quick:       200ms (button interactions)
Default:     300ms (hover effects)
Smooth:      500ms (page transitions)
Slow:        700ms+ (entrance animations)
```

### Transition Types
```
Color:       transition-colors
All:         transition-all
Transform:   transition-transform
Opacity:     transition-opacity
```

### Transform Effects
```
Scale Up:         hover:scale-105
Slide Up:         hover:-translate-y-2
Rotate:           hover:rotate-6
Blur:             backdrop-blur-md
```

---

## Component Style Guide

### Buttons

#### Primary Button
```
Light:  bg-gradient-to-r from-blue-600 to-indigo-600
        hover:from-blue-700 hover:to-indigo-700
        text-white font-bold
Dark:   Same with increased opacity
```

#### Secondary Button
```
Light:  bg-white border-2 border-blue-200
        text-blue-600 hover:bg-blue-50
Dark:   bg-gray-700 border-gray-600
        text-blue-300 hover:bg-gray-600
```

#### Icon Button
```
Light:  p-3 rounded-xl hover:bg-gray-100
Dark:   p-3 rounded-xl hover:bg-gray-700
Hover:  scale-110 transition-transform
```

### Cards

#### Default Card
```
Light:  bg-white border border-gray-200 rounded-2xl
        shadow-lg
Dark:   bg-gray-800 border border-gray-700
        shadow-lg
```

#### Stat Card
```
Light:  bg-gradient-to-br from-{color}-50 to-{color}-100
        border border-{color}-200
Dark:   bg-gray-800 border border-gray-700
```

#### Hover Effect
```
All:    hover:shadow-xl hover:-translate-y-2
        transition-all duration-300
```

### Input Fields

#### Text Input
```
Light:  bg-white border-2 border-gray-200
        focus:border-blue-500
        rounded-xl px-4 py-3
Dark:   bg-gray-700 border-2 border-gray-600
        focus:border-blue-500
```

#### Focus State
```
All:    border-2 border-blue-500
        outline-none
        ring-1 ring-blue-300
```

---

## Responsive Breakpoints

### Device Sizes
```
Mobile:    max-w-sm    (320px - 640px)
Tablet:    max-w-md    (641px - 768px)
Desktop:   max-w-xl+   (1025px+)
```

### Grid Columns
```
Mobile:    grid-cols-1
Tablet:    sm:grid-cols-2
Desktop:   lg:grid-cols-3
```

### Text Sizes (Mobile First)
```
Mobile:    text-base
Tablet:    sm:text-lg
Desktop:   md:text-xl
```

---

## Dark Mode

### Implementation
```
HTML:       <html class="dark">
Tailwind:   dark:bg-gray-900 dark:text-white
Toggle:     localStorage.setItem('darkMode', true/false)
Persistence: Saved in browser storage
```

### Dark Mode Colors
```
Primary BG:     from-gray-900
Secondary BG:   to-gray-800
Cards:          bg-gray-800
Text:           text-white
Text Muted:     text-gray-300
Borders:        border-gray-700
Accents:        Bright blue/green/red
```

---

## Accessibility Guidelines

### Color Contrast
```
Text on Background:    4.5:1 (WCAG AA)
Large Text:            3:1 (WCAG AA)
Graphics:              3:1 (WCAG AA)
```

### Touch Targets
```
Minimum Size:   44px × 44px
Recommended:    48px × 48px (mobile)
Button Height:  40px minimum
```

### Focus States
```
All Interactive: Clear focus outline
Color:          Blue 500
Width:          2px border or ring
```

---

## Icon & Emoji Usage

### Header Icons
```
🏛️  Branding
📊  Dashboard
📄  Documents
📈  Analytics
🔐  Security
👤  User
⚙️  Settings
📋  Forms
```

### Action Icons
```
✅  Success/Approve
❌  Error/Reject
⚠️  Warning/Alert
ℹ️  Information
🔄  Loading/Refresh
➡️  Next/Forward
```

### Status Icons
```
✅  Complete
⏳  Pending
❌  Failed
⏸️  Paused
```

---

## Component Combinations

### Hero Section
```
Background:   Gradient (Blue → Indigo → Purple)
Text:         White, font-black
Size:         rounded-3xl p-12
Margin:       mb-8
Example:      Welcome banners on dashboard
```

### Stat Card
```
Layout:       Flex with icon right
Colors:       Gradient background
Text:         Large typography
Icon:         Emoji, text-5xl
Hover:        Scale animation
```

### Document Card
```
Layout:       Vertical stack
Header:       Badge + Icon
Content:      Title, metadata
Footer:       Date + CTA
Hover:        Lift up animation
```

### Data Table
```
Header:       Uppercase, bold, letter-spaced
Rows:         Hover bg color
Cells:        Colored text based on data
Borders:      Subtle dividers
Responsive:   Horizontal scroll on mobile
```

---

## Animation Sequences

### Button Click
```
1. Scale: 100% → 95% (instant)
2. Color: Normal → Darker (instant)
3. Shadow: Normal → Larger (100ms)
4. Reset: All back (200ms)
```

### Card Hover
```
1. Translate: 0 → -8px (300ms)
2. Shadow: Normal → Large (300ms)
3. BG: Normal → Lighter (300ms)
```

### Page Load
```
1. Opacity: 0% → 100% (500ms)
2. Scale: 95% → 100% (500ms)
3. Blur: 4px → 0px (500ms)
```

---

## Theming Strategy

### Light Theme
```
Use Case:     Default, daytime
Background:   Gray-50 to White
Text:         Gray-900
Accents:      Bright blues, greens
Confidence:   100%
```

### Dark Theme
```
Use Case:     Evening, accessibility
Background:   Gray-900 to Gray-800
Text:         Gray-100 to White
Accents:      Bright but muted
Confidence:   100%
```

---

## Best Practices

### ✅ DO
- Use consistent spacing (multiples of 4px)
- Stack responsive modifiers (sm:, md:, lg:)
- Test on real devices
- Check dark mode
- Use semantic colors
- Maintain minimum contrast
- Add focus states
- Use gradients for impact

### ❌ DON'T
- Mix custom CSS with Tailwind
- Use inline styles
- Skip dark mode variants
- Make touch targets too small
- Use too many gradients
- Forget accessibility
- Animate too much
- Use bad contrasts

---

## Testing Checklist

- [ ] Light mode looks good
- [ ] Dark mode looks good
- [ ] Mobile responsive (375px)
- [ ] Tablet responsive (768px)
- [ ] Desktop responsive (1920px)
- [ ] All animations smooth
- [ ] All buttons clickable
- [ ] Color contrast sufficient
- [ ] Typography readable
- [ ] No horizontal scroll
- [ ] Touch targets adequate
- [ ] Focus states visible

---

## Color Palette Reference

### Status Colors
```
Success:  #10B981 (Green)
Warning:  #F59E0B (Amber)
Error:    #EF4444 (Red)
Info:     #3B82F6 (Blue)
```

### Neutral Colors
```
Black:    #000000
White:    #FFFFFF
Gray-50:  #F9FAFB
Gray-900: #111827
```

---

## Resources

### CSS Framework
```
Tailwind CSS 3.x
Responsive classes: sm:, md:, lg:, xl:, 2xl:
Dark mode: dark:
```

### Icons
```
Emojis: Native support
SVGs: Via React components
```

---

**Style Guide Version**: 2.0  
**Last Updated**: June 5, 2026  
**Status**: Complete ✅

---

This guide ensures consistency across the SSB Form 16 Portal interface. All components should follow these patterns for a cohesive user experience.
