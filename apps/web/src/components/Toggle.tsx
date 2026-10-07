import * as Switch from '@radix-ui/react-switch';

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
      <Switch.Root checked={checked} onCheckedChange={onChange}
        className="relative h-6 w-11 rounded-full bg-fg/20 transition-colors data-[state=checked]:bg-accent">
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
      {label}
    </label>
  );
}
