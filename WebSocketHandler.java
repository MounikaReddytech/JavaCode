package com.example.websocket.handler;

import com.example.websocket.service.MockDataService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class DataStreamWebSocketHandler implements WebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(DataStreamWebSocketHandler.class);
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private MockDataService mockDataService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        logger.info("WebSocket connection established: {}", sessionId);
        
        // Send welcome message
        sendMessage(session, mockDataService.createWelcomeMessage());
        
        // Start streaming data for this session
        startDataStreaming(session);
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
        logger.info("Received message from {}: {}", session.getId(), message.getPayload());
        
        // Echo back the message with timestamp
        String response = mockDataService.createEchoResponse(message.getPayload().toString());
        sendMessage(session, response);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("Transport error for session {}: {}", session.getId(), exception.getMessage());
        session.close();
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        String sessionId = session.getId();
        sessions.remove(sessionId);
        logger.info("WebSocket connection closed: {} with status: {}", sessionId, closeStatus);
    }

    @Override
    public boolean supportsPartialMessages() {
        return false;
    }

    private void startDataStreaming(WebSocketSession session) {
        scheduler.scheduleAtFixedRate(() -> {
            if (session.isOpen()) {
                try {
                    Object mockData = mockDataService.generateMockData();
                    sendMessage(session, mockData);
                } catch (Exception e) {
                    logger.error("Error streaming data to session {}: {}", session.getId(), e.getMessage());
                }
            }
        }, 1, 2, TimeUnit.SECONDS); // Stream every 2 seconds
    }

    private void sendMessage(WebSocketSession session, Object data) {
        try {
            String jsonMessage = objectMapper.writeValueAsString(data);
            session.sendMessage(new TextMessage(jsonMessage));
        } catch (IOException e) {
            logger.error("Error sending message to session {}: {}", session.getId(), e.getMessage());
        }
    }

    // Broadcast message to all connected sessions
    public void broadcastMessage(Object data) {
        sessions.values().parallelStream()
                .filter(WebSocketSession::isOpen)
                .forEach(session -> sendMessage(session, data));
    }
}
