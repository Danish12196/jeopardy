declare module 'use-sound' {
  export default function useSound(
    src: string | string[],
    options?: any
  ): [() => void, any];
}
