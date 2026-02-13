import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  firstName = "E2E",
  lastName = "Client",
  email = "client@example.com",
  isProfileCompleted = true,
  isGymLawyer = false,
  hasSignature = false,
} = {}) {
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email,
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: isProfileCompleted,
    is_gym_lawyer: isGymLawyer,
    has_signature: hasSignature,
  };
}

export async function installOrganizationsClientApiMocks(
  page,
  {
    userId,
    role = "client",
    startWithMemberships = false,
    includeInvitation = true,
    invitationScenario = "pending",
    myRequestsScenario = "ok",
    myRequestDetailScenario = "ok",
    createRequestScenario = "ok",
    postsScenario = "default",
    seedMyRequests = false,
  } = {}
) {
  const me = buildMockUser({ id: userId, role });

  const corporate = buildMockUser({
    id: userId + 100,
    role: "corporate_client",
    firstName: "E2E",
    lastName: "Corporate",
    email: "corp@example.com",
  });

  const organizationId = 1;

  const membershipOrg = {
    id: organizationId,
    title: "Acme Corp",
    description: "Organización de prueba para E2E",
    member_count: 2,
    joined_at: new Date().toISOString(),
    profile_image_url: "",
    cover_image_url: "",
    corporate_client_info: {
      full_name: `${corporate.first_name} ${corporate.last_name}`,
      email: corporate.email,
      profile_image_url: "",
    },
  };

  let memberships = startWithMemberships ? [membershipOrg] : [];
  let myRequests = [];
  const requestDetailsById = {};
  let nextResponseId = 8000;

  if (seedMyRequests) {
    const buildSeedDetail = (seeded) => ({
      ...seeded,
      organization_info: {
        id: membershipOrg.id,
        title: membershipOrg.title,
        profile_image_url: membershipOrg.profile_image_url,
      },
      client_info: {
        full_name: `${me.first_name} ${me.last_name}`,
        email: me.email,
        profile_image_url: "",
      },
      corporate_client_info: {
        full_name: membershipOrg.corporate_client_info.full_name,
        email: membershipOrg.corporate_client_info.email,
        profile_image_url: "",
      },
      assigned_to_info: null,
      files: [],
      responses: [],
    });

    if (seedMyRequests === "filters") {
      const createdAtNewest = new Date(Date.now() - 1000 * 60 * 30).toISOString();
      const createdAtMiddle = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString();
      const createdAtOldest = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString();

      const r1 = {
        id: 6201,
        request_number: "CORP-REQ-6201",
        status: "PENDING",
        priority: "HIGH",
        title: "Alpha Solicitud",
        description: "Filtro por texto: alpha",
        request_type_name: "Consulta",
        created_at: createdAtNewest,
        status_updated_at: createdAtNewest,
        response_count: 0,
        days_since_created: 0,
        organization_info: {
          title: membershipOrg.title,
          profile_image_url: membershipOrg.profile_image_url,
        },
        corporate_client_name: membershipOrg.corporate_client_info.full_name,
      };

      const r2 = {
        id: 6202,
        request_number: "CORP-REQ-6202",
        status: "CLOSED",
        priority: "LOW",
        title: "Beta Solicitud",
        description: "Filtro por estado: closed",
        request_type_name: "Consulta",
        created_at: createdAtMiddle,
        status_updated_at: createdAtMiddle,
        response_count: 2,
        days_since_created: 0,
        organization_info: {
          title: membershipOrg.title,
          profile_image_url: membershipOrg.profile_image_url,
        },
        corporate_client_name: membershipOrg.corporate_client_info.full_name,
      };

      const r3 = {
        id: 6203,
        request_number: "CORP-REQ-6203",
        status: "IN_REVIEW",
        priority: "URGENT",
        title: "Gamma Solicitud",
        description: "Filtro por prioridad: urgent",
        request_type_name: "Consulta",
        created_at: createdAtOldest,
        status_updated_at: createdAtOldest,
        response_count: 1,
        days_since_created: 2,
        organization_info: {
          title: membershipOrg.title,
          profile_image_url: membershipOrg.profile_image_url,
        },
        corporate_client_name: membershipOrg.corporate_client_info.full_name,
      };

      myRequests = [r1, r2, r3];
      requestDetailsById[r1.id] = buildSeedDetail(r1);
      requestDetailsById[r2.id] = buildSeedDetail(r2);
      requestDetailsById[r3.id] = buildSeedDetail(r3);
    } else {
      const seedRequestId = 6100;
      const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

      const seeded = {
        id: seedRequestId,
        request_number: `CORP-REQ-${seedRequestId}`,
        status: "PENDING",
        priority: "HIGH",
        title: "Solicitud Semilla E2E",
        description: "Descripción semilla E2E",
        request_type_name: "Consulta",
        created_at: createdAt,
        status_updated_at: createdAt,
        response_count: 0,
        days_since_created: 1,
        organization_info: {
          title: membershipOrg.title,
          profile_image_url: membershipOrg.profile_image_url,
        },
        corporate_client_name: membershipOrg.corporate_client_info.full_name,
      };

      myRequests = [seeded];
      requestDetailsById[seedRequestId] = buildSeedDetail(seeded);
    }
  }

  const invitationId = 9100;
  const nowIso = new Date().toISOString();
  const expiresAtDefault = new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString();
  const expiresAtExpired = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString();
  const isExpired = invitationScenario === "expired";
  let invitation = {
    id: invitationId,
    status: "PENDING",
    created_at: nowIso,
    expires_at: isExpired ? expiresAtExpired : expiresAtDefault,
    responded_at: null,
    can_be_responded: !isExpired,
    is_expired: isExpired,
    message: "",
    invited_by_info: {
      full_name: `${corporate.first_name} ${corporate.last_name}`,
      email: corporate.email,
    },
    organization_info: {
      id: organizationId,
      title: membershipOrg.title,
      description: membershipOrg.description,
      member_count: membershipOrg.member_count,
      profile_image_url: membershipOrg.profile_image_url,
      cover_image_url: membershipOrg.cover_image_url,
    },
  };

  const basePost = {
    id: 4001,
    title: "Bienvenido a Acme Corp",
    content: "Anuncio de prueba para miembros.",
    author_name: `${corporate.first_name} ${corporate.last_name}`,
    created_at: nowIso,
    is_pinned: true,
    is_active: true,
    has_link: false,
    link_name: null,
    link_url: null,
  };

  const refreshedPost = {
    ...basePost,
    id: 4002,
    title: "Anuncio Actualizado",
    content: "Contenido actualizado tras refresh.",
    created_at: new Date(Date.now() + 1000 * 60).toISOString(),
    is_pinned: false,
  };

  const publicPosts = (() => {
    if (postsScenario === "empty") return [];
    if (postsScenario === "with_link") {
      return [
        {
          ...basePost,
          has_link: true,
          link_name: "Ver enlace",
          link_url: "https://example.com",
        },
      ];
    }
    if (postsScenario === "refresh_changes") {
      return [basePost];
    }
    return [basePost];
  })();

  let postsRequestCount = 0;

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([me, corporate]),
      };
    }

    if (apiPath === `users/${userId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(me),
      };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: false }),
      };
    }

    if (apiPath === "invitations/my-invitations/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: includeInvitation ? 1 : 0,
          next: null,
          previous: null,
          results: includeInvitation ? [invitation] : [],
        }),
      };
    }

    if (apiPath === `invitations/${invitationId}/respond/`) {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON?.() || {};
        const action = body.action;

        invitation = {
          ...invitation,
          status: action === "accept" ? "ACCEPTED" : "REJECTED",
          responded_at: new Date().toISOString(),
          can_be_responded: false,
        };

        if (action === "accept") {
          memberships = [membershipOrg];
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ invitation }),
        };
      }
    }

    if (apiPath === "organizations/my-memberships/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ organizations: memberships }),
      };
    }

    const leaveOrganizationMatch = apiPath.match(/^organizations\/(\d+)\/leave\/$/);
    if (leaveOrganizationMatch) {
      const orgId = Number(leaveOrganizationMatch[1]);

      if (route.request().method() === "POST") {
        memberships = memberships.filter((org) => org.id !== orgId);

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        };
      }
    }

    if (apiPath.startsWith("corporate-requests/clients/my-requests/")) {
      if (myRequestsScenario === "forbidden" && memberships.length === 0) {
        return {
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ detail: "forbidden" }),
        };
      }

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: myRequests.length,
          next: null,
          previous: null,
          results: myRequests,
        }),
      };
    }

    const myRequestDetailMatch = apiPath.match(/^corporate-requests\/clients\/(\d+)\/$/);
    if (myRequestDetailMatch) {
      const requestId = Number(myRequestDetailMatch[1]);

      if (myRequestDetailScenario === "forbidden") {
        return {
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "forbidden" }),
        };
      }

      const detail = requestDetailsById[requestId];

      if (!detail) {
        return {
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not_found" }),
        };
      }

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ corporate_request: detail }),
      };
    }

    const myRequestResponsesMatch = apiPath.match(/^corporate-requests\/clients\/(\d+)\/responses\/$/);
    if (myRequestResponsesMatch) {
      const requestId = Number(myRequestResponsesMatch[1]);

      if (route.request().method() === "POST") {
        const detail = requestDetailsById[requestId];
        if (!detail) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const body = route.request().postDataJSON?.() || {};
        const responseText = body.response_text || "";

        const newResponse = {
          id: nextResponseId++,
          response_text: responseText,
          created_at: new Date().toISOString(),
          user_type: role,
          user_name: `${me.first_name} ${me.last_name}`,
          is_internal_note: false,
        };

        detail.responses = detail.responses || [];
        detail.responses.push(newResponse);
        detail.response_count = detail.responses.length;

        const summaryIdx = myRequests.findIndex((r) => r.id === requestId);
        if (summaryIdx >= 0) {
          myRequests[summaryIdx] = {
            ...myRequests[summaryIdx],
            response_count: detail.response_count,
          };
        }

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ response: newResponse }),
        };
      }
    }

    if (apiPath === "corporate-requests/clients/create/") {
      if (route.request().method() === "POST") {
        if (createRequestScenario === "validation_error") {
          return {
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              details: {
                title: ["Título inválido"],
              },
            }),
          };
        }

        const body = route.request().postDataJSON?.() || {};

        const requestId = 6000 + myRequests.length + 1;
        const createdAt = new Date().toISOString();

        const organizationTitle = membershipOrg.title;
        const requestTypeName = body.request_type === 1 ? "Consulta" : "Consulta";

        const newRequest = {
          id: requestId,
          request_number: `CORP-REQ-${requestId}`,
          status: "PENDING",
          priority: body.priority || "MEDIUM",
          title: body.title || "Solicitud",
          description: body.description || "",
          request_type_name: requestTypeName,
          created_at: createdAt,
          status_updated_at: createdAt,
          response_count: 0,
          days_since_created: 0,
          organization_info: {
            title: organizationTitle,
            profile_image_url: membershipOrg.profile_image_url,
          },
          corporate_client_name: membershipOrg.corporate_client_info.full_name,
        };

        myRequests.unshift(newRequest);

        requestDetailsById[requestId] = {
          ...newRequest,
          organization_info: {
            id: membershipOrg.id,
            title: organizationTitle,
            profile_image_url: membershipOrg.profile_image_url,
          },
          client_info: {
            full_name: `${me.first_name} ${me.last_name}`,
            email: me.email,
            profile_image_url: "",
          },
          corporate_client_info: {
            full_name: membershipOrg.corporate_client_info.full_name,
            email: membershipOrg.corporate_client_info.email,
            profile_image_url: "",
          },
          assigned_to_info: null,
          files: [],
          responses: [],
        };

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ corporate_request: newRequest }),
        };
      }
    }

    if (apiPath === "corporate-requests/clients/request-types/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ request_types: [{ id: 1, name: "Consulta" }] }),
      };
    }

    if (apiPath === `organizations/${organizationId}/posts/public/`) {
      if (postsScenario === "forbidden") {
        return {
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "access_denied" }),
        };
      }

      if (memberships.length === 0) {
        return {
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "access_denied" }),
        };
      }

      if (postsScenario === "refresh_changes") {
        postsRequestCount += 1;
        await new Promise((r) => setTimeout(r, 350));
        const results = postsRequestCount >= 2 ? [refreshedPost] : [basePost];

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            count: results.length,
            next: null,
            previous: null,
            results,
          }),
        };
      }

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: publicPosts.length,
          next: null,
          previous: null,
          results: publicPosts,
        }),
      };
    }

    return null;
  });
}
