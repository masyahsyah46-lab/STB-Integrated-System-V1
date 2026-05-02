
import React from 'react';
import { ApplicationData } from '../types';

interface PrintLayoutProps {
  data: ApplicationData;
  themeColor?: string;
}

const PrintLayout: React.FC<PrintLayoutProps> = ({ data, themeColor = 'blue' }) => {
  // Color mapping for theme
  const colorMap: Record<string, string> = {
    blue: '#2563eb',
    emerald: '#059669',
    orange: '#ea580c',
    indigo: '#4f46e5',
    rose: '#e11d48',
    pink: '#db2777',
    purple: '#9333ea',
    yellow: '#d97706'
  };

  const activeColor = colorMap[themeColor] || colorMap.blue;

  // Helper to format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '_____________';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
      }
    }
    return dateStr;
  };

  // Helper to format duration range
  const formatDuration = (duration?: string) => {
    if (!duration) return '_____________';
    if (duration.includes(' - ')) {
      const [start, end] = duration.split(' - ');
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    return duration;
  };

  // Ensure at least 6 rows for personnel
  const personnelRows = [...(data.personnel || [])];
  while (personnelRows.length < 6) {
    personnelRows.push({ 
      id: `empty-${personnelRows.length}`, 
      name: '', 
      isCompany: false, 
      roles: [], 
      s_ic: '', 
      s_sb: '', 
      s_epf: '' 
    });
  }

  return (
    <div id="printLayout" className="print-only-container">
      <style>{`
        .print-header-strip { background-color: ${activeColor} !important; }
        .themed-box { background-color: ${activeColor} !important; }
      `}</style>
      <div className="print-header-strip"></div>
      
      <div className="jenis-permohonan-bar">
        <div className="jenis-permohonan-row-1">
          <span style={{ marginRight: '10px' }}>PERMOHONAN:</span> 
          <span>
            <input 
              type="checkbox" 
              className="checkbox-large" 
              checked={data.jenis === 'BARU'} 
              readOnly 
            /> BARU
          </span>
          <span>
            <input 
              type="checkbox" 
              className="checkbox-large" 
              checked={data.jenis === 'PEMBAHARUAN'} 
              readOnly 
            /> PEMBAHARUAN
          </span>
          <span>
            <input 
              type="checkbox" 
              className="checkbox-large" 
              checked={data.jenis === 'UBAH MAKLUMAT'} 
              readOnly 
            /> UBAH MAKLUMAT
          </span>
          <span>
            <input 
              type="checkbox" 
              className="checkbox-large" 
              checked={data.jenis === 'UBAH GRED'} 
              readOnly 
            /> UBAH GRED
          </span>
        </div>
        
        <div className="jenis-permohonan-row-2">
          <span>NYATAKAN PERUBAHAN:</span>
          <span className="print-fill-text">
            {data.input_ubah_maklumat || data.input_ubah_gred || ''}
          </span>
        </div>
        
        <div className="jenis-permohonan-row-3" style={{ flexDirection: 'column', gap: '2px' }}>
          <div className="info-field">
            <span className="info-label">SEMAKAN TATATERTIB:</span>
            <span className="print-fill-text">{data.tatatertib || ''}</span>
          </div>
          <div className="info-field">
            <span className="info-label">JUSTIFIKASI LAWATAN:</span>
            <span className="print-fill-text">{data.justifikasi || ''}</span>
          </div>
        </div>
      </div>

      <div className="border-box themed-box" style={{ marginBottom: '5px', padding: '4px' }}>
        <span style={{ fontSize: '12pt', color: 'white', display: 'block' }}>Nama Syarikat & No CIDB:</span>
        <span className="font-large-nobold" style={{ color: 'white' }}>
          {data.syarikat} ({data.cidb})
        </span>
      </div>

      <div className="grade-bar">
        <span style={{ marginRight: '10px' }}>GRED SYARIKAT:</span>
        <span style={{ fontWeight: 900, fontSize: '16pt' }}>{data.gred}</span>
      </div>

      <table className="print-table layout-table" style={{ marginBottom: '5px', border: 'none' }}>
        <tbody>
          <tr>
            <td width="33%">
              <div className="border-box">
                <span style={{ fontSize: '12pt', color: '#666', fontWeight: 600 }}>Tempoh SPKK:</span><br />
                <span>{formatDuration(data.spkk_duration)}</span>
              </div>
            </td>
            <td width="33%">
              <div className="border-box">
                <span style={{ fontSize: '12pt', color: '#666', fontWeight: 600 }}>Tempoh STB:</span><br />
                <span>{formatDuration(data.stb_duration)}</span>
              </div>
            </td>
            <td width="33%">
              <div className="border-box">
                <span style={{ fontSize: '12pt', fontWeight: 600 }}>Tarikh e-Info SSM:</span><br />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12pt' }}>{formatDate(data.ssm_date)}</span>
                  <span style={{ fontWeight: 900, fontSize: '12pt', border: '1px solid #000', padding: '2px 5px' }}>
                    {data.ssm_status || ''}
                  </span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginBottom: '3px' }}>SENARAI PERSONEL</h2>
      <table className="print-table" id="print_personnel_table" style={{ marginBottom: 0 }}>
        <thead className="themed-box">
          <tr>
            <th rowSpan={2} style={{ textAlign: 'left', color: 'white' }}>NAMA</th>
            <th colSpan={4} style={{ textAlign: 'center', color: 'white' }}>JAWATAN</th>
            <th colSpan={4} style={{ textAlign: 'center', color: 'white' }}>SEMAKAN DOKUMEN</th>
          </tr>
          <tr>
            <th className="col-tick" style={{ color: 'white' }}>ALP</th>
            <th className="col-tick" style={{ color: 'white' }}>PE</th>
            <th className="col-tick" style={{ color: 'white' }}>TT</th>
            <th className="col-tick" style={{ color: 'white' }}>PDS</th>
            <th className="col-tick" style={{ color: 'white' }}>IC</th>
            <th className="col-tick" style={{ color: 'white' }}>SB</th>
            <th className="col-tick" style={{ color: 'white' }}>EPF</th>
          </tr>
        </thead>
        <tbody>
          {personnelRows.map((person, index) => (
            <tr key={index}>
              <td style={{ textTransform: 'uppercase' }}>{person.name}</td>
              <td className="col-tick">{person.roles?.includes('ALP') ? '✓' : ''}</td>
              <td className="col-tick">{person.roles?.includes('PE') ? '✓' : ''}</td>
              <td className="col-tick">{person.roles?.includes('TT') ? '✓' : ''}</td>
              <td className="col-tick">{person.roles?.includes('PDS') ? '✓' : ''}</td>
              <td className="col-tick">{person.s_ic || ''}</td>
              <td className="col-tick">{person.s_sb || ''}</td>
              <td className="col-tick">{person.s_epf || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: '5px', marginBottom: '3px' }}>SURAT PENGESAHAN BANK</h2>
      <table className="print-table layout-table" style={{ marginBottom: '5px', border: 'none' }}>
        <tbody>
          <tr>
            <td width="30%">
              <div className="border-box" style={{ height: '28px' }}>
                <span style={{ fontSize: '12pt', fontWeight: 700 }}>TARIKH SURAT:</span>
                <span style={{ fontWeight: 'bold', marginLeft: '10px' }}>{formatDate(data.bank_date)}</span>
              </div>
            </td>
            <td width="70%">
              <div className="border-box" style={{ height: '28px' }}>
                <span style={{ fontSize: '12pt', fontWeight: 700 }}>SYARAT PENANDATANGAN:</span>
                <span style={{ fontWeight: 'bold', marginLeft: '10px' }}>{data.bank_sign || ''}</span>
                <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>{data.bank_status || ''}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginBottom: '3px' }}>DOKUMEN UMUM & KWSP</h2>
      <table className="print-table" style={{ fontSize: '13pt', marginBottom: '5px' }}>
        <tbody>
          <tr>
            <td style={{ border: 'none', paddingBottom: '5px', fontWeight: 700 }}>
              CARTA ORGANISASI: <span className="print-result">{data.docs?.carta || ''}</span>
            </td>
            <td style={{ border: 'none', paddingBottom: '5px', fontWeight: 700 }}>
              PETA LAKARAN: <span className="print-result">{data.docs?.peta || ''}</span>
            </td>
            <td style={{ border: 'none', paddingBottom: '5px', fontWeight: 700 }}>
              GAMBAR PREMIS: <span className="print-result">{data.docs?.gambar || ''}</span>
            </td>
            <td style={{ border: 'none', paddingBottom: '5px', fontWeight: 700 }}>
              PERJANJIAN SEWA: <span className="print-result">{data.docs?.sewa || ''}</span>
            </td>
          </tr>
          <tr style={{ height: '30px' }}>
            <td colSpan={4} style={{ border: 'none' }}></td>
          </tr>
          <tr>
            <td colSpan={4} style={{ paddingTop: '5px', borderTop: '1px dotted #ccc' }}>
              <strong style={{ fontSize: '13pt' }}>KWSP (3 BULAN):</strong>
              <span style={{ borderBottom: '1px solid #000', width: 'auto', padding: '0 5px', display: 'inline-block', margin: '0 5px' }}>
                {data.kwsp?.m1 || ''}
              </span> , 
              <span style={{ borderBottom: '1px solid #000', width: 'auto', padding: '0 5px', display: 'inline-block', margin: '0 5px' }}>
                {data.kwsp?.m2 || ''}
              </span> , 
              <span style={{ borderBottom: '1px solid #000', width: 'auto', padding: '0 5px', display: 'inline-block', margin: '0 5px' }}>
                {data.kwsp?.m3 || ''}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="verification-box" style={{ height: '150px' }}>
        <div className="ver-title">BAHAGIAN PENGESYOR</div>
        <div className="options-text-center">SOKONG &nbsp;&nbsp;/&nbsp;&nbsp; BERSYARAT &nbsp;&nbsp;/&nbsp;&nbsp; SIASAT &nbsp;&nbsp;/&nbsp;&nbsp; TIDAK DISOKONG</div>
        <div className="pengesyor-grid-new">
          <div className="pengesyor-dates">
            <div>Tarikh Mohon: <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{formatDate(data.tarikh_mohon)}</span></div>
            <div>Dokumen Lengkap: _____________</div>
            <div>Tarikh Siasatan: _____________</div>
            <div>Tarikh Proses: _____________</div>
          </div>
          <div className="pengesyor-sign-box">
            <div style={{ borderTop: '1px solid #000', paddingTop: '2px' }}>(Tandatangan & Cop Pengesyor)</div>
          </div>
        </div>
      </div>

      <div className="verification-separator"></div>

      <div className="verification-box" style={{ marginBottom: 0, height: '150px' }}>
        <div>
          <div className="ver-title">BAHAGIAN PELULUS</div>
          <div style={{ borderBottom: '1px dotted #000', height: '18px', marginBottom: '8px', fontSize: '11pt', color: '#666' }}>Catatan:</div>
          <div className="options-text-center" style={{ borderBottom: 'none', paddingBottom: 0 }}>LULUS &nbsp;&nbsp;/&nbsp;&nbsp; LULUS BERSYARAT &nbsp;&nbsp;/&nbsp;&nbsp; SIASAT &nbsp;&nbsp;/&nbsp;&nbsp; TOLAK</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontWeight: 700 }}>Tarikh: ________________</div>
          <div style={{ textAlign: 'center', width: '50%' }}>
            <br /><br /><br />
            ________________________________________
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintLayout;
