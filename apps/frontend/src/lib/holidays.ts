export interface Holiday {
  date: string; // 'yyyy-MM-dd'
  name: string;
  type: 'national' | 'balinese' | 'joint-leave' | 'commemoration';
}
