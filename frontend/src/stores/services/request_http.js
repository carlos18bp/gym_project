import axios from "axios";

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

/**
 * Request endpoint
 * @param {string} method - Type request.
 * @param {string} url - Endpoint
 * @param {object} params - Params.
 * @param {object} config - Additional Axios config.
 * @returns {object} - Data and status from endpoint.
 */
async function makeRequest(method, url, params = {}, config = {}) {
  const csrfToken = getCookie("csrftoken");
  const headers = {
    "X-CSRFToken": csrfToken,
  };

  try {
    let response;

    switch (method) {
      case "GET":
        response = await axios.get(`/api/${url}`, { headers, ...config });
        break;
      case "POST":
        response = await axios.post(`/api/${url}`, params, { headers, ...config });
        break;
      case "PUT":
        response = await axios.put(`/api/${url}`, params, { headers, ...config });
        break;
      case "DELETE":
        response = await axios.delete(`/api/${url}`, { headers, ...config });
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }

    return response;
  } catch (error) {
    console.error("Error during request:", error);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Status code:", error.response.status);
    } else {
      console.error("Request failed without response.");
    }
    throw error;
  }
}

/**
 * Get request with optional responseType.
 * @param {string} url - Endpoint.
 * @param {string} responseType - Axios response type (default: json).
 * @returns {object} - Data and status from endpoint.
 */
export async function get_request(url, responseType = "json") {
  return await makeRequest("GET", url, {}, { responseType });
}

/**
 * Create request.
 * @param {string} url - Endpoint.
 * @param {object} params - Params.
 * @returns {object} - Data and status from endpoint.
 */
export async function create_request(url, params) {
  return await makeRequest("POST", url, params);
}

/**
 * Update request.
 * @param {string} url - Endpoint.
 * @param {object} params - Params.
 * @returns {object} - Data and status from endpoint.
 */
export async function update_request(url, params) {
  return await makeRequest("PUT", url, params);
}

/**
 * Delete request.
 * @param {string} url - Endpoint.
 * @returns {object} - Data and status from endpoint.
 */
export async function delete_request(url) {
  return await makeRequest("DELETE", url);
}
