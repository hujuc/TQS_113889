import React, { useState, useEffect } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useNavigate } from "react-router-dom"; // Import for redirecting to login


const API_BASE_URL = import.meta.env.VITE_API_URL + "/automations";

export default function HeatedFloorAutomation({ deviceId }) {
    const [automatizations, setAutomatizations] = useState([]);
    const [onTime, setOnTime] = useState("08:00");
    const [temperature, setTemperature] = useState(10.0); // Default temperature
    const [action, setAction] = useState("Turn On");
    const navigate = useNavigate(); // For navigation

    useEffect(() => {
        // Fetch existing automatizations
        const fetchAutomatizations = async () => {
            try {
                const token = localStorage.getItem("jwtToken");
                if (!token) {
                    navigate("/login");
                    return;
                }
                const response = await fetch(`${API_BASE_URL}`, {
                    method : "GET",
                    headers : {
                        Authorization: `Bearer ${token}`,
                    }
                });
                const data = await response.json();
                const deviceAutomatizations = data.filter(
                    (item) => item.deviceId === deviceId
                );
                setAutomatizations(deviceAutomatizations);
            } catch (err) {
                console.error("Error fetching automatizations:", err);
            }
        };

        fetchAutomatizations();

        // WebSocket connection
        const client = new Client({
            webSocketFactory: () => new SockJS(import.meta.env.VITE_API_URL.replace("/api", "/ws/devices")),
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = () => {
            client.subscribe(`/topic/device-updates`, (message) => {
                const updatedData = JSON.parse(message.body);
                if (
                    updatedData.deviceId === deviceId &&
                    updatedData.executionTime &&
                    updatedData.changes &&
                    (updatedData.changes.state === true || updatedData.changes.state === false)
                ) {
                    setAutomatizations((prev) => [...prev, updatedData]);
                }
            });
        };

        client.activate();

        return () => client.deactivate();
    }, [deviceId]);

    const handleOnTimeChange = (e) => {
        setOnTime(e.target.value);
    };

    const addAutomatization = async () => {
        const newAutomatization = {
            deviceId,
            executionTime: onTime,
            changes:
                action === "Turn On"
                    ? { state: true, temperature: parseFloat(temperature) }
                    : { state: false },
        };
        const token = localStorage.getItem("jwtToken");
        if (!token) {
            navigate("/login");
            return;
        }

        try {
            const response = await fetch(API_BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newAutomatization),
            });

            if (!response.ok) {
                throw new Error(`Failed to add automatization: ${response.statusText}`);
            }

            const data = await response.json();
            setAutomatizations([...automatizations, data]);
        } catch (err) {
            console.error("Error adding automatization:", err);
        }
    };

    const deleteAutomatization = async (index) => {
        const automatization = automatizations[index];
        const token = localStorage.getItem("jwtToken");
        if (!token) {
            navigate("/login");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/${automatization.deviceId}/${automatization.executionTime}`, {
                method: "DELETE",
                headers : {
                    Authorization: `Bearer ${token}`,
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete automatization: ${response.statusText}`);
            }

            setAutomatizations(automatizations.filter((_, i) => i !== index));
        } catch (err) {
            console.error("Error deleting automatization:", err);
            setError("Failed to delete automatization.");
        }
    };

    return (
        <div className="flex flex-col items-center w-full">
            <div className="w-full bg-white text-gray-800 p-6 rounded-xl shadow-lg mb-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-700">Automatize Heated Floors</h2>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-gray-600 font-medium">Time</label>
                        <input
                            type="time"
                            value={onTime}
                            onChange={handleOnTimeChange}
                            className="border border-gray-300 rounded-lg p-2 text-gray-700 font-medium w-32 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-gray-600 font-medium">Action</label>
                        <select
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            className="border border-gray-300 rounded-lg p-2 text-gray-700 font-medium w-32 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                        >
                            <option value="Turn On">Turn On</option>
                            <option value="Turn Off">Turn Off</option>
                        </select>
                    </div>

                    {action === "Turn On" && (
                        <div className="flex items-center justify-between">
                            <label className="text-gray-600 font-medium">Temperature</label>
                            <input
                                type="range"
                                min="0"
                                max="20"
                                step="0.2"
                                value={temperature}
                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                className="w-32 bg-gray-300 rounded-lg appearance-none cursor-pointer focus:ring-2 focus:ring-orange-500"
                            />
                            <span className="text-gray-700 font-medium">{temperature.toFixed(1)}°C</span>
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={addAutomatization}
                className="mb-6 w-14 h-14 bg-orange-500 text-white text-2xl font-bold rounded-full shadow-lg flex items-center justify-center hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
                +
            </button>

            <div className="w-full space-y-3">
                {automatizations.map((item, index) => (
                    <div
                        key={index}
                        className="bg-gray-100 text-gray-800 p-4 rounded-lg shadow-md flex items-center justify-between"
                    >
                        <div className="text-sm">
                            <span className="block font-medium">
                                Time: <span className="font-semibold">{item.executionTime}</span>
                            </span>
                            {item.changes && item.changes.state !== undefined ? (
                                <span className="block font-medium">
                                    Temperature:{" "}
                                    <span className="font-semibold">{item.changes.temperature || 0}°C</span>
                                </span>
                            ) : (
                                <span className="block font-medium">Invalid Data</span>
                            )}
                        </div>
                        <button
                            onClick={() => deleteAutomatization(index)}
                            className="text-red-500 hover:text-red-600 focus:outline-none"
                            aria-label="Delete"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                                stroke="currentColor"
                                className="w-6 h-6"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10"
                                />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
