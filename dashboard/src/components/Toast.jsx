import React, { useEffect } from 'react';
import '../styles/Toast.css';

export default function Toast({ message }) {
    return <div className="toast show">{message}</div>;
}
