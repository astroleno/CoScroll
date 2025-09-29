// 聚合可复用的业务模块，便于 p5 与其他运行时直接引入
// 尽量保持只导出“纯逻辑/数据/类型”，避免耦合 React/Three 组件

export * from "@/data/heartSutra";
export * from "@/data/mvp-content";
export * from "@/config/experience.config";
export * from "@/types/content.types";
export * from "@/types/model.types";
export * from "@/utils/lrcParser";
export * from "@/utils/contentManager";

// 状态：如果继续使用 Zustand，可在 p5 中直接使用；
// 若未来替换为事件总线，可在此文件内做同名导出适配。
export * as stores from "@/stores";


