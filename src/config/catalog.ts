export const PROJECT_CATALOG = [
  {id: 'heart-sutra', title: '心经', artist: '王菲', recording: '歌曲版', duration: '06:14'},
  {id: 'lotus-sutra-zanshi', title: '妙法莲华经', artist: '赞诗', recording: '摘编歌曲 · 神农尝百草·卷一', duration: '04:01'},
] as const;

export function isCatalogProject(id: string) {
  return PROJECT_CATALOG.some(project => project.id === id);
}
