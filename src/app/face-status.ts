export type FaceStatus =
  { name: 'loading' } | { name: 'ready'; delegate: 'GPU' | 'CPU' } | { name: 'error' }
