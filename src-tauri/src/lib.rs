use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::sync::Mutex;

struct ServerState {
    child_id: Mutex<Option<u32>>,
}

#[tauri::command]
async fn check_server_health() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client
        .get("http://localhost:3001/api/health")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerState {
            child_id: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle().clone();

            // Spawn sidecar server
            tauri::async_runtime::spawn(async move {
                let shell = handle.shell();

                // Resolve resource directory where server-bundle.cjs and node_modules live
                let resource_dir = handle
                    .path()
                    .resource_dir()
                    .expect("failed to resolve resource dir");
                let binaries_res = resource_dir.join("binaries");

                let node_path = binaries_res.join("node_modules");

                let mut cmd = shell
                    .sidecar("aiyou-server")
                    .expect("failed to create sidecar command");

                // On Windows, the sidecar is a copy of node.exe — pass server-bundle.cjs as arg
                #[cfg(target_os = "windows")]
                {
                    let bundle_path = binaries_res.join("server-bundle.cjs");
                    cmd = cmd.args([bundle_path.to_string_lossy().to_string()]);
                }

                // Set environment variables for the sidecar
                cmd = cmd
                    .env("NODE_PATH", node_path.to_string_lossy().to_string())
                    .env("DB_CLIENT", "sqlite");

                let (mut rx, child) = cmd.spawn().expect("failed to spawn sidecar");

                // Store child PID for cleanup
                let state = handle.state::<ServerState>();
                *state.child_id.lock().unwrap() = Some(child.pid());

                // Log sidecar output
                tauri::async_runtime::spawn(async move {
                    use tauri_plugin_shell::process::CommandEvent;
                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(line) => {
                                let s = String::from_utf8_lossy(&line);
                                println!("[server] {}", s);
                            }
                            CommandEvent::Stderr(line) => {
                                let s = String::from_utf8_lossy(&line);
                                eprintln!("[server:err] {}", s);
                            }
                            CommandEvent::Terminated(payload) => {
                                eprintln!(
                                    "[server] terminated with code {:?}, signal {:?}",
                                    payload.code, payload.signal
                                );
                                break;
                            }
                            _ => {}
                        }
                    }
                });

                // Wait for server to be ready
                let client = reqwest::Client::new();
                let mut ready = false;
                for i in 0..60 {
                    match client
                        .get("http://localhost:3001/api/health")
                        .timeout(std::time::Duration::from_secs(2))
                        .send()
                        .await
                    {
                        Ok(resp) if resp.status().is_success() => {
                            println!("[tauri] Server ready after {} attempts", i + 1);
                            ready = true;
                            break;
                        }
                        _ => {
                            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                        }
                    }
                }

                if !ready {
                    eprintln!("[tauri] Server failed to start within 30 seconds");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![check_server_health])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
