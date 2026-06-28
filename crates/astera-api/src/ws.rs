use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State as AxumState;
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::broadcast;

use crate::AppState;

/// WebSocket endpoint — broadcasts index events to connected clients
pub async fn ws_handler(ws: WebSocketUpgrade, AxumState(state): AxumState<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state.event_tx))
}

async fn handle_socket(socket: WebSocket, tx: broadcast::Sender<String>) {
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to broadcast events
    let mut rx = tx.subscribe();

    // Send initial connection message
    let welcome = serde_json::json!({
        "event": "connected",
        "message": "Connected to Astera event stream"
    });
    if let Ok(()) = sender.send(Message::Text(welcome.to_string().into())).await {
        // Connected
    }

    // Spawn task to forward broadcast events to the WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Read incoming messages (client can send commands, but we mostly just echo)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(_msg)) = receiver.next().await {
            // Client messages are ignored for now
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }
}

/// Broadcast an index event to all connected WebSocket clients
pub fn broadcast_event(tx: &broadcast::Sender<String>, event: &crate::IndexEvent) {
    if let Ok(json) = serde_json::to_string(event) {
        let _ = tx.send(json);
    }
}
