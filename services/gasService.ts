
const GAS_URL_STB = "https://script.google.com/macros/s/AKfycbxURP82mPlQ7VAI6174CXQFTBdyUyrPvhtiso_U0XsD-3Toqn5PXp_W043hiKhk-ueP/exec";

export const MAIN_DRIVE_URL = "https://drive.google.com/drive/folders/1-IszGRdSjoJz2oOjUs_KO7HRz7oE2Hzn";

const getUrlByRole = (_role?: string, _source?: 'STB' | 'SPI') => {
  return GAS_URL_STB;
};

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    // GAS might return 200 but with an error message in the body if it's a custom error
    if (!response.ok && retries > 0) {
      console.warn(`Fetch failed with status ${response.status}. Retrying... (${retries} left)`);
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch error: ${error}. Retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

export const gasService = {
  /**
   * Fetches all application records
   */
  async fetchAll(role?: string, source?: 'STB' | 'SPI'): Promise<any[]> {
    const url = getUrlByRole(role, source);
    try {
      let response;
      try {
        response = await fetchWithRetry(`${url}?action=getApplications`, {
          method: 'GET',
          cache: 'no-cache',
          redirect: 'follow'
        });
      } catch (getErr) {
        console.warn(`GET fetchAll failed for ${source}, trying POST fallback...`);
        response = await fetchWithRetry(url, {
          method: 'POST',
          mode: 'cors',
          cache: 'no-cache',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getApplications' })
        });
      }
      
      if (!response.ok) {
        throw new Error(`Gagal mengambil data dari Google Sheets (Status: ${response.status})`);
      }
      
      const result = await response.json();
      const data = Array.isArray(result) ? result : (result.data || []);
      
      // Basic normalization for application data
      return data.map((item: any) => ({
        ...item,
        // Ensure numeric fields are numbers if they come as strings
        row: item.row ? Number(item.row) : undefined,
        // Ensure boolean fields are booleans
        is_beku: item.is_beku === true || item.is_beku === 'TRUE' || item.is_beku === 'true',
      }));
    } catch (error) {
      console.error("GAS fetchAll Error:", error);
      // Return empty array but log the error for debugging
      return [];
    }
  },

  /**
   * Fetches authorized users and their theme colors from both sources
   */
  async fetchUsers(): Promise<any[]> {
    const fetchFrom = async (url: string, source: 'STB' | 'SPI') => {
      const getOptions: RequestInit = {
        method: 'GET',
        cache: 'no-cache',
        redirect: 'follow'
      };

      const postOptions: RequestInit = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getUsers' })
      };

      try {
        let response;
        try {
          // Try GET first
          response = await fetchWithRetry(`${url}?action=getUsers`, getOptions);
        } catch (getErr) {
          console.warn(`GET fetch failed for ${source}, trying POST fallback...`);
          // Try POST fallback if GET fails (likely CORS or network issue)
          response = await fetchWithRetry(url, postOptions);
        }
        
        if (!response.ok) {
          console.warn(`Gagal mengambil pengguna dari ${source} (Status: ${response.status})`);
          return [];
        }
        
        const result = await response.json();
        const data = Array.isArray(result) ? result : (result.data || []);
        
        return data.map((u: any) => {
          const findKey = (obj: any, target: string) => {
            const key = Object.keys(obj).find(k => k.toLowerCase() === target.toLowerCase());
            return key ? obj[key] : undefined;
          };

          const name = findKey(u, 'name') || findKey(u, 'nama') || '';
          const pin = findKey(u, 'pin') || '';
          const role = findKey(u, 'role') || findKey(u, 'peranan') || '';
          const id = findKey(u, 'id') || undefined;

          return {
            ...u,
            source,
            id: id ? String(id).trim() : undefined,
            name: String(name).trim(),
            pin: String(pin).trim(),
            role: String(role).trim()
          };
        });
      } catch (e) {
        console.error(`GAS fetchUsers Exception from ${source}:`, e);
        return [];
      }
    };

    try {
      const allUsers = await fetchFrom(GAS_URL_STB, 'STB');
      
      if (allUsers.length === 0) {
        // Fallback only if both fail
        return [
          { id: "STB-P001", name: "ADMIN", pin: "1234", role: "PENGESYOR", color: "BIRU", source: 'STB' },
          { id: "STB-L001", name: "APPROVER", pin: "5678", role: "PELULUS", color: "HIJAU", source: 'STB' },
          { id: "STB-KS01", name: "KS SPTB", pin: "1111", role: "KS SPTB", color: "UNGU", source: 'STB' },
          { id: "STB-PP01", name: "PP SPTB", pin: "2222", role: "PP SPTB", color: "ORANGE", source: 'STB' }
        ];
      }

      const uniqueMap = new Map();
      allUsers.forEach(u => {
        if (!u.name || !u.pin) return;
        
        const key = `${String(u.name).toUpperCase().trim()}-${String(u.pin).trim()}`;
        if (uniqueMap.has(key)) {
          const existing = uniqueMap.get(key);
          const uRole = String(u.role || '').toLowerCase();
          const eRole = String(existing.role || '').toLowerCase();
          
          if (uRole && !eRole.includes(uRole)) {
            existing.role = `${existing.role}, ${u.role}`;
          }
          
          if (u.source === 'SPI') {
            existing.hasSpiSource = true;
            existing.source = 'SPI';
          }
        } else {
          uniqueMap.set(key, { 
            ...u, 
            hasSpiSource: u.source === 'SPI' 
          });
        }
      });
      
      return Array.from(uniqueMap.values());
    } catch (error) {
      console.error("GAS fetchUsers Fatal Error:", error);
      return [];
    }
  },

  /**
   * AI Data Extraction via backend GAS
   */
  async processAI(text: string, type: 'borang' | 'profile' = 'borang'): Promise<any> {
    try {
      const response = await fetchWithRetry(GAS_URL_STB, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'processAI', type, text })
      });
      if (!response.ok) throw new Error(`GAS AI Error: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Gagal ekstraksi AI backend");
      return result.data;
    } catch (e) {
      console.error("processAI backend error:", e);
      throw e;
    }
  },

  /**
   * Undo Recommendation or Approval
   */
  async undoAction(row: number, type: 'undo_syor' | 'undo_lulus', user: string): Promise<boolean> {
    try {
      const response = await fetchWithRetry(GAS_URL_STB, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteRecord', row, deleteType: type, user })
      });
      if (!response.ok) return false;
      const result = await response.json();
      return result.status === 'success';
    } catch (e) {
      console.error("undoAction error:", e);
      return false;
    }
  },

  /**
   * Padam Rekod Sepenuhnya
   */
  async deleteRecord(row: number, user: string): Promise<boolean> {
    try {
      const response = await fetchWithRetry(GAS_URL_STB, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteRecord', row, deleteType: 'padam_semua', user })
      });
      if (!response.ok) return false;
      const result = await response.json();
      return result.status === 'success';
    } catch (e) {
      console.error("deleteRecord error:", e);
      return false;
    }
  },

  /**
   * Sends or updates an application record
   */
  async saveRecord(data: any, role?: string, source?: 'STB' | 'SPI'): Promise<{ success: boolean; message: string; pautan?: string; folderId?: string }> {
    const url = getUrlByRole(role, source);
    try {
      // Data validation before sending
      if (!data.syarikat || !data.cidb) {
        return { success: false, message: "Data tidak lengkap (Syarikat/CIDB diperlukan)" };
      }

      const flattenedData: any = { ...data };
      
      // Handle personnel
      if (data.personnel) {
        flattenedData.personnel_json = JSON.stringify(data.personnel);
        delete flattenedData.personnel;
      }

      // Remove any undefined values to avoid JSON.stringify issues
      Object.keys(flattenedData).forEach(key => {
        if (flattenedData[key] === undefined) {
          flattenedData[key] = '';
        }
      });

      const response = await fetchWithRetry(url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(flattenedData),
      });

      if (!response.ok) {
        throw new Error(`Ralat Pelayan: ${response.status}`);
      }
      
      const result = await response.json().catch(() => ({ success: true, message: "Data dihantar" }));
      
      return { 
        success: result.status === 'success' || result.success !== false, 
        message: result.message || "Data berjaya diselaraskan",
        pautan: result.pautan,
        folderId: result.folderId
      };
    } catch (error) {
      console.error("GAS saveRecord Error:", error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Ralat rangkaian atau isu CORS" 
      };
    }
  },

  /**
   * General purpose submission to GAS
   */
  async submitToGas(payload: any): Promise<any> {
    try {
      const response = await fetchWithRetry(GAS_URL_STB, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`GAS Error: ${response.status}`);
      return await response.json();
    } catch (e) {
      console.error("submitToGas error:", e);
      throw e;
    }
  },

  /**
   * Requests folder creation
   */
  async createFolder(params: { 
    company_name: string; 
    month_year: string; 
    application_type: string; 
    user_name: string; 
    role?: string;
    source?: 'STB' | 'SPI';
  }): Promise<{ success: boolean; folder_url?: string; user_folder_url?: string }> {
    const url = getUrlByRole(params.role, params.source);
    try {
      const response = await fetchWithRetry(url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          action: 'createDriveFolder', 
          main_folder_id: '1-IszGRdSjoJz2oOjUs_KO7HRz7oE2Hzn',
          ...params 
        }),
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        if (result.success) {
          return { 
            success: true, 
            folder_url: result.folder_url, 
            user_folder_url: result.user_folder_url 
          };
        }
      }

      const fallbackUrl = `${MAIN_DRIVE_URL}?q=${encodeURIComponent(params.company_name)}`;
      return { success: true, folder_url: fallbackUrl };
    } catch (error) {
      console.error("Create Folder Error:", error);
      const fallbackUrl = `${MAIN_DRIVE_URL}?q=${encodeURIComponent(params.company_name)}`;
      return { success: true, folder_url: fallbackUrl };
    }
  }
};

