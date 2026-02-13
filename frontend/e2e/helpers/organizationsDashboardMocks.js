import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  firstName = "E2E",
  lastName = "Corporate",
  email = "corp@example.com",
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

export function buildMockOrganization({
  id,
  title,
  description = "Descripción E2E",
  memberCount = 2,
  pendingInvitationsCount = 1,
  createdAt = new Date().toISOString(),
  profileImageUrl = "",
  coverImageUrl = "",
  isActive = true,
} = {}) {
  return {
    id,
    title,
    description,
    member_count: memberCount,
    pending_invitations_count: pendingInvitationsCount,
    created_at: createdAt,
    profile_image_url: profileImageUrl,
    cover_image_url: coverImageUrl,
    is_active: isActive,
  };
}

export function buildMockCorporateRequest({
  id,
  requestNumber,
  status = "PENDING",
  priority = "MEDIUM",
  title = "Solicitud Corporativa",
  description = "Descripción de la solicitud",
  requestTypeName = "Consulta",
  createdAt = new Date().toISOString(),
  responseCount = 0,
  daysSinceCreated = 3,
  clientFullName = "Client One",
  clientEmail = "client@example.com",
  clientName,
  organizationId,
  organizationTitle = "Acme Corp",
} = {}) {
  return {
    id,
    request_number: requestNumber,
    status,
    priority,
    title,
    description,
    request_type_name: requestTypeName,
    created_at: createdAt,
    status_updated_at: createdAt,
    response_count: responseCount,
    days_since_created: daysSinceCreated,
    client_name: clientName || clientFullName,
    client_info: {
      full_name: clientFullName,
      email: clientEmail,
      profile_image_url: "",
    },
    organization_info: {
      id: organizationId,
      title: organizationTitle,
      profile_image_url: "",
    },
  };
}

export function buildMockCorporateRequestDetail({
  id,
  requestNumber,
  status = "PENDING",
  priority = "MEDIUM",
  title = "Solicitud Corporativa",
  description = "Descripción de la solicitud",
  requestTypeName = "Consulta",
  createdAt = new Date().toISOString(),
  statusUpdatedAt = null,
  responseCount = 0,
  daysSinceCreated = 3,
  clientFullName = "Client One",
  clientEmail = "client@example.com",
  corporateClientFullName = "E2E Corporate",
  corporateClientEmail = "corp@example.com",
  organizationId,
  organizationTitle = "Acme Corp",
  responses = [],
  files = [],
} = {}) {
  return {
    id,
    request_number: requestNumber,
    status,
    priority,
    title,
    description,
    request_type_name: requestTypeName,
    created_at: createdAt,
    status_updated_at: statusUpdatedAt || createdAt,
    response_count: responseCount,
    days_since_created: daysSinceCreated,
    estimated_completion_date: null,
    actual_completion_date: null,
    files,
    responses,
    client_info: {
      full_name: clientFullName,
      email: clientEmail,
      profile_image_url: "",
    },
    corporate_client_info: {
      full_name: corporateClientFullName,
      email: corporateClientEmail,
      profile_image_url: "",
    },
    assigned_to_info: null,
    organization_info: {
      id: organizationId,
      title: organizationTitle,
      profile_image_url: "",
    },
  };
}

export async function installOrganizationsDashboardApiMocks(
  page,
  {
    userId,
    role = "corporate_client",
    startWithOrganizations = true,
    seedOrganizations,
    seedMembersByOrgId,
    seedReceivedRequests,
    clientUserId,
    clientUserEmail = "client@example.com",
    sentInvitationScenario = "pending",
    startWithClientMemberships = false,
  } = {}
) {
  const me = buildMockUser({ id: userId, role });

  const clientUser = clientUserId
    ? buildMockUser({
        id: clientUserId,
        role: "client",
        firstName: "E2E",
        lastName: "Client",
        email: clientUserEmail,
      })
    : null;

  const knownUsers = clientUser ? [me, clientUser] : [me];

  const organization = buildMockOrganization({
    id: 1,
    title: "Acme Corp",
    description: "Organización de prueba para E2E",
    memberCount: 2,
    pendingInvitationsCount: 1,
  });

  let organizations = startWithOrganizations
    ? Array.isArray(seedOrganizations)
      ? seedOrganizations
      : [organization]
    : [];
  let nextOrganizationId = organizations.reduce((maxId, org) => Math.max(maxId, org.id || 0), 0);

  const primaryOrganization = organizations.length > 0 ? organizations[0] : organization;

  let receivedRequests = startWithOrganizations && organizations.length > 0
    ? Array.isArray(seedReceivedRequests)
      ? seedReceivedRequests
      : [
          buildMockCorporateRequest({
            id: 5001,
            requestNumber: "CORP-REQ-5001",
            organizationId: primaryOrganization.id,
            organizationTitle: primaryOrganization.title,
            clientFullName: "Client One",
            clientEmail: "client@example.com",
          }),
        ]
    : [];

  // Ensure requests have organization_info.id so organization filter works
  receivedRequests = receivedRequests.map((req) => {
    const fallbackOrgId = primaryOrganization.id;
    return {
      ...req,
      client_name: req.client_name || req.client_info?.full_name,
      organization_info: {
        ...req.organization_info,
        id: req.organization_info?.id ?? fallbackOrgId,
      },
    };
  });

  const requestDetailsById = new Map();
  receivedRequests.forEach((req) => {
    const detail = buildMockCorporateRequestDetail({
      id: req.id,
      requestNumber: req.request_number,
      status: req.status,
      priority: req.priority,
      title: req.title,
      description: req.description,
      requestTypeName: req.request_type_name,
      createdAt: req.created_at,
      statusUpdatedAt: req.status_updated_at,
      responseCount: req.response_count || 0,
      responses: [],
      files: [],
      clientFullName: req.client_info?.full_name,
      clientEmail: req.client_info?.email,
      corporateClientFullName: `${me.first_name} ${me.last_name}`,
      corporateClientEmail: me.email,
      organizationId: req.organization_info?.id,
      organizationTitle: req.organization_info?.title,
    });
    requestDetailsById.set(req.id, detail);
  });

  let nextClientRequestId = 6000;

  const managementPostsByOrgId = {};
  const getPostsForOrg = (orgId) => {
    if (!managementPostsByOrgId[orgId]) {
      managementPostsByOrgId[orgId] = [];
    }
    return managementPostsByOrgId[orgId];
  };
  let nextPostId = 10000;

  const buildClientMembershipOrg = (org) => {
    return {
      id: org.id,
      title: org.title,
      description: org.description,
      member_count: org.member_count,
      joined_at: new Date().toISOString(),
      profile_image_url: org.profile_image_url || "",
      cover_image_url: org.cover_image_url || "",
      corporate_client_info: {
        full_name: `${me.first_name} ${me.last_name}`,
        email: me.email,
        profile_image_url: "",
      },
    };
  };

  let clientMemberships =
    clientUser && startWithClientMemberships && organizations.length > 0
      ? [buildClientMembershipOrg(primaryOrganization)]
      : [];

  if (startWithOrganizations) {
    organizations.forEach((org) => getPostsForOrg(org.id));
  }

  const membersByOrgId = {};
  const getMembersForOrg = (orgId) => {
    if (!membersByOrgId[orgId]) {
      membersByOrgId[orgId] = [];
    }
    return membersByOrgId[orgId];
  };

  if (startWithOrganizations) {
    organizations.forEach((org) => getMembersForOrg(org.id));

    if (seedMembersByOrgId && typeof seedMembersByOrgId === "object") {
      Object.entries(seedMembersByOrgId).forEach(([orgId, members]) => {
        if (Array.isArray(members)) {
          getMembersForOrg(Number(orgId)).push(...members);
        }
      });
    } else {
      const defaultOrg = organizations.find((o) => o.id === organization.id) || organizations[0];
      if (defaultOrg) {
        getMembersForOrg(defaultOrg.id).push(
          {
            id: 3001,
            role: "ADMIN",
            role_display: "Admin",
            is_active: true,
            joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
            user_info: {
              first_name: "Client",
              last_name: "One",
              full_name: "Client One",
              email: "client@example.com",
              profile_image_url: "",
            },
          },
          {
            id: 3002,
            role: "MEMBER",
            role_display: "Miembro",
            is_active: true,
            joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
            user_info: {
              first_name: "Client",
              last_name: "Two",
              full_name: "Client Two",
              email: "client2@example.com",
              profile_image_url: "",
            },
          }
        );
      }
    }
  }

  let nextInvitationId = 9000;
  let nextMembershipMemberId = 9100;
  let clientInvitations = [];

  await mockApi(page, async ({ route, apiPath }) => {
    // Auth
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    // Captcha (some pages may request this opportunistically)
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    // Users
    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(knownUsers),
      };
    }

    const userDetailMatch = apiPath.match(/^users\/(\d+)\/$/);
    if (userDetailMatch) {
      const requestedId = Number(userDetailMatch[1]);
      const found = knownUsers.find((u) => u.id === requestedId);
      return {
        status: found ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(found || { error: "not_found" }),
      };
    }

    const userSignatureMatch = apiPath.match(/^users\/(\d+)\/signature\/$/);
    if (userSignatureMatch) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: false }),
      };
    }

    // Client dashboard endpoints (used by ClientDashboard on mount)
    if (apiPath === "organizations/my-memberships/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ organizations: clientMemberships }),
      };
    }

    if (apiPath === "invitations/my-invitations/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: clientInvitations.length,
          next: null,
          previous: null,
          results: clientInvitations,
        }),
      };
    }

    const respondInvitationMatch = apiPath.match(/^invitations\/(\d+)\/respond\/$/);
    if (respondInvitationMatch) {
      const invitationId = Number(respondInvitationMatch[1]);

      if (route.request().method() === "POST") {
        const idx = clientInvitations.findIndex((inv) => inv.id === invitationId);
        if (idx < 0) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const invitation = clientInvitations[idx];
        const body = route.request().postDataJSON?.() || {};
        const action = body.action;

        const newStatus = action === "accept" ? "ACCEPTED" : "REJECTED";
        const updatedInvitation = {
          ...invitation,
          status: newStatus,
          responded_at: new Date().toISOString(),
          can_be_responded: false,
        };
        clientInvitations[idx] = updatedInvitation;

        // Update org stats on accept/reject (pending invites decrement)
        const orgId = invitation.organization_info?.id;
        const orgIdx = organizations.findIndex((o) => o.id === orgId);
        if (orgIdx >= 0) {
          const prevOrg = organizations[orgIdx];
          const nextPending = Math.max(0, (prevOrg.pending_invitations_count || 0) - 1);
          const nextMembers =
            action === "accept" ? (prevOrg.member_count || 0) + 1 : prevOrg.member_count || 0;

          organizations[orgIdx] = {
            ...prevOrg,
            pending_invitations_count: nextPending,
            member_count: nextMembers,
          };

          // Update members list and client memberships on accept
          if (action === "accept" && clientUser) {
            const members = getMembersForOrg(orgId);
            const alreadyMember = members.some(
              (m) => m.user_info?.email === clientUser.email || m.user_info?.full_name === `${clientUser.first_name} ${clientUser.last_name}`
            );
            if (!alreadyMember) {
              members.push({
                id: nextMembershipMemberId++,
                role: "MEMBER",
                role_display: "Miembro",
                is_active: true,
                joined_at: new Date().toISOString(),
                user_info: {
                  first_name: clientUser.first_name,
                  last_name: clientUser.last_name,
                  full_name: `${clientUser.first_name} ${clientUser.last_name}`,
                  email: clientUser.email,
                  profile_image_url: "",
                },
              });
            }

            const membershipExists = clientMemberships.some((m) => m.id === orgId);
            if (!membershipExists) {
              clientMemberships = [buildClientMembershipOrg(organizations[orgIdx]), ...clientMemberships];
            }
          }
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ invitation: updatedInvitation }),
        };
      }
    }

    if (apiPath.startsWith("corporate-requests/clients/my-requests/")) {
      if (clientMemberships.length === 0) {
        return {
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ detail: "forbidden" }),
        };
      }

      const clientRequests = clientUser
        ? receivedRequests
            .filter((r) => r.client_info?.email === clientUser.email)
            .map((r) => {
              const detail = requestDetailsById.get(r.id);
              const visibleResponses = detail?.responses
                ? detail.responses.filter((resp) => !resp.is_internal_note)
                : null;

              if (!visibleResponses) {
                return r;
              }

              return {
                ...r,
                response_count: visibleResponses.length,
              };
            })
        : [];

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: clientRequests.length,
          next: null,
          previous: null,
          results: clientRequests,
        }),
      };
    }

    if (apiPath === "corporate-requests/clients/create/") {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON?.() || {};

        if (!clientUser) {
          return {
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ error: "missing_client_user" }),
          };
        }

        const organizationId = Number(body.organization) || primaryOrganization.id;
        const org = organizations.find((o) => o.id === organizationId) || primaryOrganization;
        const requestId = ++nextClientRequestId;

        const newRequest = buildMockCorporateRequest({
          id: requestId,
          requestNumber: `CORP-REQ-${requestId}`,
          status: "PENDING",
          priority: body.priority || "MEDIUM",
          title: body.title || "Solicitud",
          description: body.description || "",
          requestTypeName: "Consulta",
          createdAt: new Date().toISOString(),
          responseCount: 0,
          daysSinceCreated: 0,
          clientFullName: `${clientUser.first_name} ${clientUser.last_name}`,
          clientEmail: clientUser.email,
          organizationId: org.id,
          organizationTitle: org.title,
        });

        receivedRequests.unshift(newRequest);

        const detail = buildMockCorporateRequestDetail({
          id: newRequest.id,
          requestNumber: newRequest.request_number,
          status: newRequest.status,
          priority: newRequest.priority,
          title: newRequest.title,
          description: newRequest.description,
          requestTypeName: newRequest.request_type_name,
          createdAt: newRequest.created_at,
          statusUpdatedAt: newRequest.status_updated_at,
          responseCount: 0,
          responses: [],
          files: [],
          clientFullName: newRequest.client_info?.full_name,
          clientEmail: newRequest.client_info?.email,
          corporateClientFullName: `${me.first_name} ${me.last_name}`,
          corporateClientEmail: me.email,
          organizationId: newRequest.organization_info?.id,
          organizationTitle: newRequest.organization_info?.title,
        });
        requestDetailsById.set(newRequest.id, detail);

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ corporate_request: newRequest }),
        };
      }
    }

    const clientRequestDetailMatch = apiPath.match(/^corporate-requests\/clients\/(\d+)\/$/);
    if (clientRequestDetailMatch) {
      const reqId = Number(clientRequestDetailMatch[1]);

      if (clientMemberships.length === 0) {
        return {
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ detail: "forbidden" }),
        };
      }

      const requestDetail = requestDetailsById.get(reqId);
      if (!requestDetail) {
        return {
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not_found" }),
        };
      }

      if (clientUser && requestDetail.client_info?.email && requestDetail.client_info.email !== clientUser.email) {
        return {
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not_found" }),
        };
      }

      const visibleResponses = requestDetail.responses
        ? requestDetail.responses.filter((resp) => !resp.is_internal_note)
        : [];

      const clientSafeDetail = {
        ...requestDetail,
        responses: visibleResponses,
        response_count: visibleResponses.length,
      };

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ corporate_request: clientSafeDetail }),
      };
    }

    const clientRequestResponsesMatch = apiPath.match(
      /^corporate-requests\/clients\/(\d+)\/responses\/$/
    );
    if (clientRequestResponsesMatch) {
      if (route.request().method() === "POST") {
        const reqId = Number(clientRequestResponsesMatch[1]);

        if (clientMemberships.length === 0) {
          return {
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ detail: "forbidden" }),
          };
        }

        const requestDetail = requestDetailsById.get(reqId);
        if (!requestDetail) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        if (clientUser && requestDetail.client_info?.email && requestDetail.client_info.email !== clientUser.email) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const body = route.request().postDataJSON?.() || {};
        const author = clientUser || me;
        const newResponse = {
          id: 8001 + (requestDetail.responses?.length || 0),
          user_type: "client",
          user_name: `${author.first_name} ${author.last_name}`,
          response_text: body.response_text || "",
          is_internal_note: false,
          created_at: new Date().toISOString(),
        };

        requestDetail.responses = requestDetail.responses || [];
        requestDetail.responses.push(newResponse);
        requestDetail.response_count = requestDetail.responses.length;

        const idx = receivedRequests.findIndex((r) => r.id === reqId);
        if (idx >= 0) {
          receivedRequests[idx] = {
            ...receivedRequests[idx],
            response_count: requestDetail.response_count,
          };
        }

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ response: newResponse }),
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

    // Organizations dashboard core data
    if (apiPath === "organizations/my-organizations/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: organizations.length,
          next: null,
          previous: null,
          results: organizations,
        }),
      };
    }

    // Create organization
    if (apiPath === "organizations/create/") {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON?.() || {};

        const newOrg = buildMockOrganization({
          id: ++nextOrganizationId,
          title: body.title || "Nueva Organización",
          description: body.description || "",
          memberCount: 0,
          pendingInvitationsCount: 0,
          createdAt: new Date().toISOString(),
        });

        organizations.unshift(newOrg);
        getPostsForOrg(newOrg.id);

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ organization: newOrg }),
        };
      }
    }

    // Organization members (corporate_client)
    const membersMatch = apiPath.match(/^organizations\/(\d+)\/members\/$/);
    if (membersMatch) {
      const orgId = Number(membersMatch[1]);
      if (route.request().method() === "GET") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ members: getMembersForOrg(orgId) }),
        };
      }
    }

    const removeMemberMatch = apiPath.match(
      /^organizations\/(\d+)\/members\/(\d+)\/remove\/$/
    );
    if (removeMemberMatch) {
      const orgId = Number(removeMemberMatch[1]);
      const removeUserId = Number(removeMemberMatch[2]);

      if (route.request().method() === "DELETE") {
        const orgIdx = organizations.findIndex((o) => o.id === orgId);
        const prevMembers = getMembersForOrg(orgId);
        const removedUser = knownUsers.find((u) => u.id === removeUserId);

        const nextMembers = prevMembers.filter((m) => {
          if (m.id === removeUserId) return false;
          if (removedUser && m.user_info?.email === removedUser.email) return false;
          return true;
        });

        membersByOrgId[orgId] = nextMembers;

        if (orgIdx >= 0 && nextMembers.length !== prevMembers.length) {
          const prevOrg = organizations[orgIdx];
          organizations[orgIdx] = {
            ...prevOrg,
            member_count: Math.max(0, (prevOrg.member_count || 0) - 1),
          };
        }

        if (clientUser && removeUserId === clientUser.id) {
          clientMemberships = clientMemberships.filter((m) => m.id !== orgId);
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        };
      }
    }

    const leaveOrganizationMatch = apiPath.match(/^organizations\/(\d+)\/leave\/$/);
    if (leaveOrganizationMatch) {
      const orgId = Number(leaveOrganizationMatch[1]);

      if (route.request().method() === "POST") {
        if (clientUser) {
          const orgIdx = organizations.findIndex((o) => o.id === orgId);
          const prevMembers = getMembersForOrg(orgId);

          const nextMembers = prevMembers.filter((m) => {
            if (m.id === clientUser.id) return false;
            if (m.user_info?.email === clientUser.email) return false;
            return true;
          });

          membersByOrgId[orgId] = nextMembers;

          clientMemberships = clientMemberships.filter((m) => m.id !== orgId);

          if (orgIdx >= 0 && nextMembers.length !== prevMembers.length) {
            const prevOrg = organizations[orgIdx];
            organizations[orgIdx] = {
              ...prevOrg,
              member_count: Math.max(0, (prevOrg.member_count || 0) - 1),
            };
          }
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        };
      }
    }

    // Update organization
    const updateOrganizationMatch = apiPath.match(/^organizations\/(\d+)\/update\/$/);
    if (updateOrganizationMatch) {
      if (route.request().method() === "PUT") {
        const orgId = Number(updateOrganizationMatch[1]);
        const body = route.request().postDataJSON?.() || {};
        const idx = organizations.findIndex((o) => o.id === orgId);

        if (idx < 0) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const prev = organizations[idx];
        const updatedOrg = {
          ...prev,
          title: body.title ?? prev.title,
          description: body.description ?? prev.description,
          is_active: body.is_active ?? prev.is_active,
        };

        organizations[idx] = updatedOrg;

        const membershipIdx = clientMemberships.findIndex((m) => m.id === orgId);
        if (membershipIdx >= 0) {
          clientMemberships[membershipIdx] = {
            ...clientMemberships[membershipIdx],
            title: updatedOrg.title,
            description: updatedOrg.description,
            member_count: updatedOrg.member_count,
            profile_image_url: updatedOrg.profile_image_url || clientMemberships[membershipIdx].profile_image_url,
            cover_image_url: updatedOrg.cover_image_url || clientMemberships[membershipIdx].cover_image_url,
          };
        }

        if (updatedOrg.is_active === false) {
          clientMemberships = clientMemberships.filter((m) => m.id !== orgId);
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ organization: updatedOrg }),
        };
      }
    }

    if (apiPath === "organizations/stats/") {
      const totalMembers = organizations.reduce((sum, org) => sum + (org.member_count || 0), 0);
      const totalPendingInvites = organizations.reduce(
        (sum, org) => sum + (org.pending_invitations_count || 0),
        0
      );

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total_organizations: organizations.length,
          total_members: totalMembers,
          total_pending_invitations: totalPendingInvites,
          recent_requests_count: receivedRequests.length,
          active_organizations_count: organizations.filter((o) => o.is_active).length,
          organizations_by_status: { active: organizations.filter((o) => o.is_active).length },
          recent_invitations_count: totalPendingInvites,
        }),
      };
    }

    // Organization posts (management)
    const postsListMatch = apiPath.match(/^organizations\/(\d+)\/posts\/$/);
    if (postsListMatch) {
      const orgId = Number(postsListMatch[1]);
      if (route.request().method() === "GET") {
        const posts = getPostsForOrg(orgId);
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            count: posts.length,
            next: null,
            previous: null,
            results: posts,
          }),
        };
      }
    }

    // Organization posts (public, for members)
    const publicPostsMatch = apiPath.match(/^organizations\/(\d+)\/posts\/public\/$/);
    if (publicPostsMatch) {
      const orgId = Number(publicPostsMatch[1]);

      // Ensure the user is a member of this org
      const hasMembership = clientMemberships.some((org) => org.id === orgId);
      if (!hasMembership) {
        return {
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "access_denied" }),
        };
      }

      if (route.request().method() === "GET") {
        const posts = getPostsForOrg(orgId)
          .filter((p) => p.is_active)
          .map((p) => ({
            ...p,
            author_name: p.author_name || `${me.first_name} ${me.last_name}`,
          }));

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            count: posts.length,
            next: null,
            previous: null,
            results: posts,
          }),
        };
      }
    }

    // Create post
    const createPostMatch = apiPath.match(/^organizations\/(\d+)\/posts\/create\/$/);
    if (createPostMatch) {
      if (route.request().method() === "POST") {
        const orgId = Number(createPostMatch[1]);
        const body = route.request().postDataJSON?.() || {};

        const hasLink = Boolean(body.link_name && body.link_url);
        const newPost = {
          id: ++nextPostId,
          title: body.title || "Post",
          content: body.content || "",
          author_name: `${me.first_name} ${me.last_name}`,
          is_pinned: Boolean(body.is_pinned),
          is_active: true,
          has_link: hasLink,
          link_name: hasLink ? body.link_name : null,
          link_url: hasLink ? body.link_url : null,
          created_at: new Date().toISOString(),
        };

        getPostsForOrg(orgId).unshift(newPost);

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ post: newPost }),
        };
      }
    }

    // Update post
    const updatePostMatch = apiPath.match(/^organizations\/(\d+)\/posts\/(\d+)\/update\/$/);
    if (updatePostMatch) {
      if (route.request().method() === "PUT") {
        const orgId = Number(updatePostMatch[1]);
        const postId = Number(updatePostMatch[2]);
        const body = route.request().postDataJSON?.() || {};
        const posts = getPostsForOrg(orgId);
        const idx = posts.findIndex((p) => p.id === postId);

        if (idx < 0) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const prev = posts[idx];
        const hasLink = Boolean(body.link_name && body.link_url);
        const updatedPost = {
          ...prev,
          title: body.title ?? prev.title,
          content: body.content ?? prev.content,
          is_pinned: body.is_pinned ?? prev.is_pinned,
          is_active: body.is_active ?? prev.is_active,
          has_link: hasLink,
          link_name: hasLink ? body.link_name : null,
          link_url: hasLink ? body.link_url : null,
        };

        posts[idx] = updatedPost;

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ post: updatedPost }),
        };
      }
    }

    // Toggle pin
    const togglePinMatch = apiPath.match(/^organizations\/(\d+)\/posts\/(\d+)\/toggle-pin\/$/);
    if (togglePinMatch) {
      if (route.request().method() === "POST") {
        const orgId = Number(togglePinMatch[1]);
        const postId = Number(togglePinMatch[2]);
        const posts = getPostsForOrg(orgId);
        const idx = posts.findIndex((p) => p.id === postId);
        if (idx < 0) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const updatedPost = {
          ...posts[idx],
          is_pinned: !posts[idx].is_pinned,
        };
        posts[idx] = updatedPost;

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ post: updatedPost }),
        };
      }
    }

    // Toggle active status
    const toggleStatusMatch = apiPath.match(/^organizations\/(\d+)\/posts\/(\d+)\/toggle-status\/$/);
    if (toggleStatusMatch) {
      if (route.request().method() === "POST") {
        const orgId = Number(toggleStatusMatch[1]);
        const postId = Number(toggleStatusMatch[2]);
        const posts = getPostsForOrg(orgId);
        const idx = posts.findIndex((p) => p.id === postId);
        if (idx < 0) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const updatedPost = {
          ...posts[idx],
          is_active: !posts[idx].is_active,
        };
        posts[idx] = updatedPost;

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ post: updatedPost }),
        };
      }
    }

    // Delete post
    const deletePostMatch = apiPath.match(/^organizations\/(\d+)\/posts\/(\d+)\/delete\/$/);
    if (deletePostMatch) {
      if (route.request().method() === "DELETE") {
        const orgId = Number(deletePostMatch[1]);
        const postId = Number(deletePostMatch[2]);
        const posts = getPostsForOrg(orgId);
        managementPostsByOrgId[orgId] = posts.filter((p) => p.id !== postId);

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        };
      }
    }

    // Corporate received requests
    if (apiPath === "corporate-requests/corporate/received/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: receivedRequests.length,
          next: null,
          previous: null,
          results: receivedRequests,
        }),
      };
    }

    // Corporate request detail
    const corporateRequestDetailMatch = apiPath.match(/^corporate-requests\/corporate\/(\d+)\/$/);
    if (corporateRequestDetailMatch) {
      const reqId = Number(corporateRequestDetailMatch[1]);
      const requestDetail = requestDetailsById.get(reqId);
      if (!requestDetail) {
        return {
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not_found" }),
        };
      }
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          corporate_request: requestDetail,
        }),
      };
    }

    // Add response to corporate request
    const corporateRequestResponsesMatch = apiPath.match(
      /^corporate-requests\/corporate\/(\d+)\/responses\/$/
    );
    if (corporateRequestResponsesMatch) {
      if (route.request().method() === "POST") {
        const reqId = Number(corporateRequestResponsesMatch[1]);
        const requestDetail = requestDetailsById.get(reqId);
        if (!requestDetail) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const body = route.request().postDataJSON?.() || {};
        const newResponse = {
          id: 7001 + requestDetail.responses.length,
          user_type: role,
          user_name: `${me.first_name} ${me.last_name}`,
          response_text: body.response_text || "",
          is_internal_note: Boolean(body.is_internal_note),
          created_at: new Date().toISOString(),
        };

        requestDetail.responses.push(newResponse);
        requestDetail.response_count = requestDetail.responses.length;

        const idx = receivedRequests.findIndex((r) => r.id === reqId);
        if (idx >= 0) {
          receivedRequests[idx] = {
            ...receivedRequests[idx],
            response_count: requestDetail.response_count,
          };
        }

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ response: newResponse }),
        };
      }
    }

    // Update corporate request
    const corporateRequestUpdateMatch = apiPath.match(
      /^corporate-requests\/corporate\/(\d+)\/update\/$/
    );
    if (corporateRequestUpdateMatch) {
      if (route.request().method() === "PUT") {
        const reqId = Number(corporateRequestUpdateMatch[1]);
        const requestDetail = requestDetailsById.get(reqId);
        if (!requestDetail) {
          return {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "not_found" }),
          };
        }

        const body = route.request().postDataJSON?.() || {};
        if (body.status) {
          requestDetail.status = body.status;
          requestDetail.status_updated_at = new Date().toISOString();

          const idx = receivedRequests.findIndex((r) => r.id === reqId);
          if (idx >= 0) {
            receivedRequests[idx] = {
              ...receivedRequests[idx],
              status: body.status,
              status_updated_at: requestDetail.status_updated_at,
            };
          }
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ corporate_request: requestDetail }),
        };
      }
    }

    // Invite member flow
    if (/^organizations\/\d+\/invitations\/send\/$/.test(apiPath)) {
      if (route.request().method() === "POST") {
        const orgId = Number(apiPath.split("/")[1]);
        const body = route.request().postDataJSON?.() || {};
        const invitedEmail = body.invited_user_email || body.email || "client@example.com";
        const message = body.message || "";

        const nowIso = new Date().toISOString();
        const expiresAtDefault = new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString();
        const expiresAtExpired = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString();
        const isExpired = sentInvitationScenario === "expired";
        const isValidationError = sentInvitationScenario === "validation_error";

        if (isValidationError) {
          return {
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              details: {
                invited_user_email: ["Email del cliente no válido"],
              },
            }),
          };
        }

        const idx = organizations.findIndex((o) => o.id === orgId);
        if (idx >= 0) {
          organizations[idx] = {
            ...organizations[idx],
            pending_invitations_count: (organizations[idx].pending_invitations_count || 0) + 1,
          };
        }

        const org = organizations.find((o) => o.id === orgId) || primaryOrganization;
        const invitation = {
          id: ++nextInvitationId,
          status: "PENDING",
          created_at: nowIso,
          expires_at: isExpired ? expiresAtExpired : expiresAtDefault,
          responded_at: null,
          can_be_responded: !isExpired,
          is_expired: isExpired,
          message,
          invited_by_info: {
            full_name: `${me.first_name} ${me.last_name}`,
            email: me.email,
          },
          organization_info: {
            id: org.id,
            title: org.title,
            description: org.description,
            member_count: org.member_count,
            profile_image_url: org.profile_image_url || "",
            cover_image_url: org.cover_image_url || "",
          },
        };

        // Only add to client invitations if it's the known client email
        if (!clientUser || invitedEmail === clientUser.email) {
          clientInvitations.unshift(invitation);
        }

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            invitation,
          }),
        };
      }
    }

    return null;
  });
}
