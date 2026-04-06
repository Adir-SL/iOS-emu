use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

// iOS Safari UA for iPhone iOS 18.3
const IOS_UA: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1";

/// Builds the initialization script that spoofs the user agent before any page JS runs.
fn ua_init_script() -> String {
    format!(
        r#"
(function() {{
  try {{
    Object.defineProperty(navigator, 'userAgent', {{
      get: function() {{ return '{ua}'; }},
      configurable: false,
      enumerable: true
    }});
  }} catch(e) {{}}
}})();
"#,
        ua = IOS_UA
    )
}

#[tauri::command]
async fn navigate(webview: tauri::WebviewWindow, url: String) -> Result<(), String> {
    webview
        .navigate(url.parse().map_err(|e| format!("Invalid URL: {e}"))?)
        .map_err(|e| format!("Navigate error: {e}"))
}

#[tauri::command]
async fn inject_css(webview: tauri::WebviewWindow, id: String, css: String) -> Result<(), String> {
    let escaped_id = id.replace('\'', "\\'");
    let escaped_css = css.replace('`', "\\`");
    let js = format!(
        r#"
(function() {{
  var existing = document.getElementById('{id}');
  if (existing) existing.remove();
  var s = document.createElement('style');
  s.id = '{id}';
  s.textContent = `{css}`;
  document.head.appendChild(s);
}})();
"#,
        id = escaped_id,
        css = escaped_css
    );
    webview
        .eval(&js)
        .map_err(|e| format!("inject_css error: {e}"))
}

#[tauri::command]
async fn remove_css(webview: tauri::WebviewWindow, id: String) -> Result<(), String> {
    let escaped_id = id.replace('\'', "\\'");
    let js = format!(
        r#"
(function() {{
  var el = document.getElementById('{id}');
  if (el) el.remove();
}})();
"#,
        id = escaped_id
    );
    webview
        .eval(&js)
        .map_err(|e| format!("remove_css error: {e}"))
}

#[tauri::command]
async fn inject_js(webview: tauri::WebviewWindow, js: String) -> Result<(), String> {
    webview
        .eval(&js)
        .map_err(|e| format!("inject_js error: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("iOS Safari Tester")
                .inner_size(520.0, 980.0)
                .decorations(false)
                .transparent(true)
                .resizable(false)
                .initialization_script(&ua_init_script())
                .build()?;

            // Allow the window to be dragged from anywhere initially;
            // the frontend sets up the drag region via data-tauri-drag-region
            let _ = window;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![navigate, inject_css, remove_css, inject_js])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
