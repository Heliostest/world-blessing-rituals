import {
  FORBIDDEN_SUCCESS_PHRASES,
  GLOBAL_DISCLAIMER,
} from '@wbr/shared'

export function About() {
  return (
    <main className="page">
      <h1>关于</h1>
      <p className="disclaimer" role="note">
        {GLOBAL_DISCLAIMER}
      </p>
      <h2>文案约束</h2>
      <p>
        界面只描述手势练习与互动反馈，不宣称宗教效力或养成结果。下列用语禁止作为成功态文案出现（免责声明常量本身除外）：
      </p>
      <ul className="list">
        {FORBIDDEN_SUCCESS_PHRASES.map((phrase) => (
          <li key={phrase}>
            <code>{phrase}</code>
          </li>
        ))}
      </ul>
      <p className="muted">
        开发时对用户可见字符串调用 <code>assertSafeCopy</code>，避免误写禁用词。
      </p>
    </main>
  )
}
