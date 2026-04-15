import React from 'react';
import '../styles/AccessControlMatrix.css';

export default function AccessControlMatrix() {
    const matrix = [
        {
            role: 'Person A',
            permissions: {
                submit: false,
                scan: false,
                attest: false,
                yield: false,
                release: true,
            },
        },
        {
            role: 'Person B',
            permissions: {
                submit: false,
                scan: true,
                attest: true,
                yield: true,
                release: false,
            },
        },
        {
            role: 'Person C',
            permissions: {
                submit: true,
                scan: false,
                attest: false,
                yield: false,
                release: false,
            },
        },
    ];

    return (
        <div className="card acl-card">
            <h2 className="card-title">Access Control Matrix</h2>
            <div className="acl-table">
                <table>
                    <thead>
                        <tr>
                            <th>Role</th>
                            <th>Submit</th>
                            <th>Scan</th>
                            <th>Attest</th>
                            <th>Yield</th>
                            <th>Release</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row, i) => (
                            <tr key={i}>
                                <td>{row.role}</td>
                                <td className={row.permissions.submit ? 'acl-allow' : 'acl-deny'}>
                                    {row.permissions.submit ? '✓' : '✗'}
                                </td>
                                <td className={row.permissions.scan ? 'acl-allow' : 'acl-deny'}>
                                    {row.permissions.scan ? '✓' : '✗'}
                                </td>
                                <td className={row.permissions.attest ? 'acl-allow' : 'acl-deny'}>
                                    {row.permissions.attest ? '✓' : '✗'}
                                </td>
                                <td className={row.permissions.yield ? 'acl-allow' : 'acl-deny'}>
                                    {row.permissions.yield ? '✓' : '✗'}
                                </td>
                                <td className={row.permissions.release ? 'acl-allow' : 'acl-deny'}>
                                    {row.permissions.release ? '✓' : '✗'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
